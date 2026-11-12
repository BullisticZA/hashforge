// HashForge UI: game loop, screens, 3D overlays and saving.

import {
  ALGOS, GPU_ALGOS, GPUS, ASICS, PSUS, FRAMES, COOLING, RACKS, INVERTERS, BATTERIES, SOLAR, GENERATORS,
  LOCATIONS, REGIONS, RISERS, BOOT, MODS, OS, FACILITY, byId,
  CASES, BOARDS, CPUS, RAM, DRIVES, UPSES, DRIVE_CLASS, CLIENT_TYPES, SERVER_OS,
} from '../data/catalog.js';
import { QUALITY, JUNK_LOTS, UPGRADES, upgradeCost, forkThreshold, forkReward, CRAFT_FEE, PART_TYPES } from '../data/progression.js';
import * as E from '../sim/engine.js';
import * as C from '../sim/career.js';
import { sfx, soundOn, setSound } from './sfx.js';
import { confetti, banner } from './celebrate.js';
import { FloorPlan } from './floor2d.js';
import { detectRegion, fetchFx, makeMoney, num, hashrate, kw, gameDate, esc } from './format.js';

const SAVE_KEY = 'hashforge-save-v2';
const SPEEDS = [0, 1, 6, 24, 96];          // game hours per real second
const $ = (sel) => document.querySelector(sel);

const SLOTS_KEY = 'hashforge-slots-v1';
// Grouped menu: run the operation, buy hardware, build things, grow.
const NAV = [
  ['Run', [['floor', '🏭', 'Floor'], ['servers', '🖥️', 'Servers'], ['clients', '🤝', 'Clients'], ['power', '⚡', 'Power']]],
  ['Buy', [['shop', '🛒', 'Vendors'], ['used', '♻️', 'Used'], ['junk', '🗑️', 'Junkyard']]],
  ['Build', [['bench', '🛠️', 'Workbench'], ['inventory', '📦', 'Inventory']]],
  ['Grow', [['career', '🏆', 'Career'], ['market', '📈', 'Market'], ['fork', '🔱', 'Hard Fork'], ['settings', '⚙️', 'Settings']]],
];
const SHOP_TABS = [
  ['gpu', 'GPUs', GPUS], ['asic', 'ASIC miners', ASICS], ['frame', 'Rig kits', FRAMES], ['psu', 'Power supplies', PSUS],
  ['parts', 'Risers, boot & thermal', [...RISERS, ...BOOT, ...MODS]],
  ['rack', 'Racks', RACKS], ['cooling', 'Cooling & AC', COOLING], ['energy', 'Solar & backup', [...INVERTERS, ...BATTERIES, ...SOLAR, ...GENERATORS]],
  ['pc', 'PCs, NAS & servers', CASES], ['components', 'PC & server parts', [...BOARDS, ...CPUS, ...RAM, ...DRIVES]], ['ups', 'UPS', UPSES],
  ['location', 'Locations', []],
];
const COMPONENT_KINDS = [['all', 'All'], ['board', 'Motherboards'], ['cpu', 'CPUs'], ['ram', 'Memory'], ['drive', 'Drives']];
const SERVER_PARTS = ['board', 'cpu', 'ram', 'drive', 'psu', 'gpu'];

export class App {
  constructor() {
    this.view = 'floor';
    this.shopTab = 'gpu';
    this.speedIndex = 1;
    this.selection = null;
    this.bench = {};
    this.lastRender = 0;
    this.load();
    C.ensure(this.state);
    C.tick(this.state);               // settle XP and badges from before this session quietly
    this.cashShown = this.state.cash;
    this.money = makeMoney(this.state);
    this.renderNav();
    this.bindEvents();
    this.render();
    this.updateFx();
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.showStart();
    setInterval(() => this.save(), 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  // ---------------------------------------------------------------- persistence

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        this.state = E.deserialize(raw);
        if (this.state.savedAt) {
          const away = E.catchUp(this.state, Date.now() - this.state.savedAt);
          if (away) this.awayReport = away;
        }
        return;
      }
    } catch { /* corrupt or old save: start fresh */ }
    const region = detectRegion();
    this.state = E.newGame(undefined, { region });
  }

  save() {
    this.state.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, E.serialize(this.state)); } catch { /* storage unavailable */ }
  }

  async updateFx() {
    const reg = E.region(this.state);
    const rate = await fetchFx(reg.currency);
    if (rate) {
      E.setFx(this.state, rate);
      this.fxLive = true;
      this.render(true);
    }
  }

  // ---------------------------------------------------------------- loop

  loop(now) {
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const speed = SPEEDS[this.speedIndex];
    if (speed && !this.state.gameOver) {
      const logBefore = this.state.log[0];
      E.advance(this.state, dt * speed);
      if (this.state.log[0] !== logBefore) this.announce(this.state.log[0]);
    }
    this.room = E.roomStats(this.state);
    if (this.floor && this.view === 'floor') { this.floor.speed = speed; this.floor.draw(this.state, this.room, now / 1000); }
    // Cash counts up (or down) smoothly instead of jumping.
    const cash = this.state.cash;
    this.cashShown += (cash - this.cashShown) * Math.min(1, dt * 6);
    if (Math.abs(cash - this.cashShown) < 0.005) this.cashShown = cash;
    const cashEl = document.getElementById('hud-cash');
    if (cashEl) { const t = this.money(this.cashShown); if (cashEl.textContent !== t) cashEl.textContent = t; }
    if (this.tour) this.tour.sync(this.state, this.room, E.location(this.state));
    if (now - this.lastRender > 400) { this.lastRender = now; this.render(); }
    requestAnimationFrame((t) => this.loop(t));
  }

  announce(entry) {
    if (!entry) return;
    if (['warning', 'milestone', 'bill'].includes(entry.type)) this.toast(entry.text, entry.type === 'warning' ? 'bad' : entry.type === 'milestone' ? 'gold' : '');
  }

  /** Replace {{usd:N}} tokens from the engine with the player's currency. */
  fmt(text) {
    return String(text).replace(/\{\{usd:(-?[\d.]+)\}\}/g, (_, n) => this.money(parseFloat(n)));
  }

  toast(text, kind = '') {
    text = this.fmt(text);
    if (kind === 'bad') sfx.bad();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 4200);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }

  result(res, okText) {
    if (!res.ok) { this.toast(res.error, 'bad'); this.render(true); return false; }
    if (okText) this.toast(okText, 'good');
    this.render(true);
    return true;
  }

  // ---------------------------------------------------------------- events

  bindEvents() {
    document.addEventListener('pointerdown', () => { this.pointerDown = true; }, true);
    document.addEventListener('pointerup', () => { setTimeout(() => { this.pointerDown = false; }, 0); }, true);
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const { action, id, uid, arg } = el.dataset;
      sfx.click();
      this.act(action, { id, uid, arg, el });
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'import-file' && e.target.files?.[0]) { this.importSave(e.target.files[0]); e.target.value = ''; return; }
      const el = e.target.closest('[data-change]');
      if (!el) return;
      this.act(el.dataset.change, { value: el.value, uid: el.dataset.uid, el });
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); this.speedIndex = this.speedIndex ? 0 : 1; this.render(true); }
      if (e.key === 'Escape') { this.closeOverlay(); this.closeStart(); }
      if (/^[1-4]$/.test(e.key)) { this.speedIndex = +e.key; this.render(true); }
    });
  }

  act(action, a) {
    const s = this.state;
    const m = this.money;
    switch (action) {
      case 'nav': this.view = a.id; this.selection = null; this.render(true); break;
      case 'speed': this.speedIndex = +a.arg; this.render(true); break;
      case 'shop-tab': this.shopTab = a.id; this.shopFilter = ''; this.render(true); break;
      case 'shop-filter': this.shopFilter = a.value; this.render(true); break;
      case 'shop-sort': this.shopSort = a.value; this.render(true); break;
      case 'buy': {
        const item = byId[a.id];
        const res = E.buy(s, a.id);
        if (!res.ok) { this.toast(res.error, 'bad'); break; }
        const where = this.autoInstall(res.uid);
        this.toast(where ? `Bought ${item.name} and installed it in ${where}` : `Bought ${item.name}`, 'good');
        if (item.kind === 'frame') this.toast('Now add a PSU, GPUs and a boot drive: click the rig on the Floor.', '');
        this.render(true);
        break;
      }
      case 'inspect': this.openViewer(byId[a.id], a.uid ? this.findOwned(a.uid) : {}); break;
      case 'buy-listing': {
        const res = E.buyListing(s, a.id);
        if (!res.ok) { this.toast(res.error, 'bad'); break; }
        const where = this.autoInstall(res.uid);
        this.toast(where ? `Bought second-hand and installed it in ${where}` : 'Bought second-hand', 'good');
        this.render(true);
        break;
      }
      case 'install-to': {
        const kind = byId[this.findOwned(a.uid).id].kind;
        const res = kind === 'gpu' ? E.installGpu(s, a.arg, a.uid) : kind === 'psu' ? E.installPsu(s, a.arg, a.uid) : E.installBoot(s, a.arg, a.uid);
        this.result(res, `Installed in ${s.rigs.find((r) => r.uid === a.arg)?.name}`);
        break;
      }
      case 'auto-install': s.autoInstall = s.autoInstall === false; this.render(true); break;
      case 'dismiss-away': this.awayReport = null; this.render(true); break;
      case 'buy-lot': {
        const res = E.buyLot(s, a.id);
        if (this.result(res)) this.showLot(JUNK_LOTS.find((l) => l.id === a.id), res.found);
        break;
      }
      case 'move': this.result(E.moveTo(s, a.id), `Welcome to the ${LOCATIONS.find((l) => l.id === a.id).name}!`); break;
      case 'select': this.selection = { type: a.arg, uid: a.uid }; this.render(true); break;
      case 'open-rig': this.openRig(a.uid); break;
      case 'install': {
        const kind = byId[this.findOwned(a.uid).id].kind;
        const res = kind === 'gpu' ? E.installGpu(s, a.arg, a.uid) : E.installPsu(s, a.arg, a.uid);
        if (this.result(res)) this.refreshOverlay();
        break;
      }
      case 'uninstall': if (this.result(E.uninstall(s, a.arg, a.uid))) this.refreshOverlay(); break;
      case 'autofill': {
        const r = E.autoFill(s, a.uid);
        const bits = r.ok ? [r.added.gpus && `${r.added.gpus} GPU${r.added.gpus > 1 ? 's' : ''}`, r.added.psus && `${r.added.psus} PSU${r.added.psus > 1 ? 's' : ''}`, r.added.boot && 'a boot drive'].filter(Boolean) : [];
        if (this.result(r, r.ok ? `Installed ${bits.join(', ')}` : '')) this.refreshOverlay();
        break;
      }
      case 'toggle': this.result(E.toggle(s, a.uid)); this.refreshOverlay(); break;
      case 'algo': this.result(E.setRigAlgo(s, a.uid, a.value)); break;
      case 'repair': {
        const res = E.repair(s, a.uid);
        if (this.result(res, res.ok ? `Repaired for ${m(res.cost)}` : '')) this.refreshOverlay();
        break;
      }
      case 'sell': {
        const res = E.sell(s, a.uid);
        if (this.result(res, res.ok ? `Sold for ${m(res.value)}` : '')) { this.selection = null; this.refreshOverlay(); }
        break;
      }
      case 'salvage': this.result(E.salvage(s, a.uid), 'Stripped into parts: see the Workbench'); break;
      case 'sell-part': { const r = E.sellPart(s, a.uid); this.result(r, r.ok ? `Sold for ${m(r.value)}` : ''); break; }
      case 'bench-pick': this.bench[a.arg] = this.bench[a.arg] === a.uid ? null : a.uid; if (a.arg === 'core') this.bench = { core: this.bench.core }; this.render(true); break;
      case 'craft': {
        const res = E.craftGpu(s, this.bench);
        if (this.result(res)) {
          this.toast(`Built a ${QUALITY[res.grade].name} card!`, res.grade === 'golden' ? 'gold' : 'good');
          const card = this.findOwned(res.uid);
          this.bench = {};
          this.openViewer(byId[card.id], card, { assemble: true });
        }
        break;
      }
      case 'install-boot': if (this.result(E.installBoot(s, a.arg, a.uid), 'Boot drive installed')) this.refreshOverlay(); break;
      case 'swap-riser': {
        const [rigUid, slot] = a.arg.split(':');
        if (this.result(E.swapRiser(s, rigUid, +slot, a.uid), 'Riser swapped')) this.refreshOverlay();
        break;
      }
      case 'os': if (this.result(E.setOs(s, a.uid, a.value))) this.refreshOverlay(); break;
      case 'mod': if (this.result(E.applyMod(s, a.uid, a.arg), 'Mod applied')) this.refreshOverlay(); break;
      case 'clean': { const r = E.cleanDust(s); this.result(r, r.ok ? `Cleaned for ${m(r.cost)}` : ''); break; }
      case 'facility': this.result(E.buyFacility(s, a.id), 'Installed'); break;
      case 'tariff-plan': this.result(E.setTariffPlan(s, a.value)); break;
      case 'reset-breaker': this.result(E.resetBreaker(s), 'Breaker reset'); break;
      case 'grid-charge': s.energy.gridCharge = !s.energy.gridCharge; this.render(true); break;
      case 'tariff': this.result(E.setTariff(s, parseFloat(a.value)), 'Tariff updated'); break;
      case 'region': {
        const reg = REGIONS.find((r) => r.id === a.value);
        s.region = reg.id; s.tariffLocal = reg.tariff; s.fx = reg.fx;
        this.money = makeMoney(s);
        this.updateFx();
        this.render(true);
        break;
      }
      case 'upgrade': this.result(E.buyUpgrade(s, a.id), 'Upgrade unlocked'); break;
      case 'fork': {
        if (!this.confirmTwice(a.el, 'Click again to Hard Fork')) return;
        const res = E.hardFork(s);
        if (res.ok) { this.state = res.state; this.money = makeMoney(this.state); this.toast(`Hard Fork complete: +${res.reward} Fork Shards`, 'gold'); this.save(); this.render(true); }
        else this.toast(res.error, 'bad');
        break;
      }
      case 'new-game':
        if (!this.confirmTwice(a.el, 'Click again: this wipes your save')) return;
        this.state = E.newGame(undefined, { region: this.state.region, tariffLocal: this.state.tariffLocal, fx: this.state.fx });
        this.money = makeMoney(this.state); this.save(); this.render(true);
        break;
      case 'tour': this.openTour(); break;
      // ---- servers
      case 'srv-select': this.serverSel = this.serverSel === a.uid ? null : a.uid; this.render(true); break;
      case 'srv-add': this.result(E.installServerPart(s, a.arg, a.uid), 'Installed'); break;
      case 'srv-remove': this.result(E.removeServerPart(s, a.arg, a.uid), 'Removed to inventory'); break;
      case 'srv-autofill': { const r = E.autoFillServer(s, a.uid); this.result(r, r.ok ? `Installed ${r.added} part${r.added > 1 ? 's' : ''}` : ''); break; }
      case 'srv-toggle': { const sv = s.servers.find((x) => x.uid === a.uid); if (sv) { sv.on = !sv.on; this.render(true); } break; }
      case 'srv-raid': { const sv = s.servers.find((x) => x.uid === a.uid); this.result(E.setRaid(s, a.uid, !sv?.raid), sv?.raid ? 'Drive protection off' : 'Drive protection on: one drive can fail without losing data'); break; }
      case 'srv-os': this.result(E.setServerOs(s, a.uid, a.value), 'Operating system changed'); break;
      case 'srv-rename': this.result(E.renameServer(s, a.uid, a.value)); break;
      case 'srv-3d': this.openMachine(a.uid); break;
      case 'srv-shop': this.buildFor = a.uid; this.view = 'shop'; this.shopTab = 'components'; this.compKind = a.arg || 'all'; this.render(true); break;
      case 'comp-kind': this.compKind = a.id; this.render(true); break;
      case 'fit-only': this.buildFor = this.buildFor ? null : (this.serverSel || s.servers[0]?.uid); this.render(true); break;
      // ---- clients
      case 'offer-accept': { const r = E.acceptOffer(s, a.id, a.arg || undefined); this.result(r, r.ok ? `Signed ${r.client.client}` : ''); break; }
      case 'client-move': { const [cid, uid] = a.value.split('|'); if (uid) this.result(E.moveClient(s, cid, uid), 'Client migrated'); break; }
      case 'client-end': if (this.confirmTwice(a.el, 'End contract?')) this.result(E.endContract(s, a.id)); break;
      // ---- saves
      case 'save-now': this.save(); this.toast('Game saved', 'good'); break;
      case 'slot-save': this.saveSlot(+a.arg); break;
      case 'slot-load': if (this.confirmTwice(a.el, 'Load? Unsaved progress is lost')) this.loadSlot(+a.arg); break;
      case 'slot-delete': if (this.confirmTwice(a.el, 'Delete?')) { const slots = this.slots(); slots[+a.arg] = null; this.writeSlots(slots); this.render(true); } break;
      case 'export-save': this.exportSave(); break;
      case 'import-save': $('#import-file')?.click(); break;
      case 'explode': this.viewer?.setExploded(a.el.classList.toggle('on')); break;
      case 'close-overlay': this.closeOverlay(); break;
      // ---- career
      case 'claim-job': {
        const r = C.claimJob(s, a.id);
        if (!r.ok) { this.toast(r.error, 'bad'); break; }
        sfx.coin();
        const box = a.el.getBoundingClientRect();
        confetti({ x: (box.left + box.width / 2) / innerWidth, y: box.top / innerHeight, count: 40, spread: 0.6 });
        this.toast(`💼 Contract paid: +{{usd:${r.job.reward}}} and ${r.job.xp} XP`, 'gold');
        this.celebrate({ levelUps: r.levelUps });
        this.render(true);
        break;
      }
      case 'drop-job': C.dropJob(s, a.id); this.render(true); break;
      case 'event-choice': {
        const r = C.resolveEvent(s, +a.arg);
        if (!r.ok) { this.toast(r.error, 'bad'); break; }
        if (r.uid) this.autoInstall(r.uid);
        this.toast(r.text, r.bad ? 'bad' : 'good');
        if (!r.bad) sfx.coin();
        this.celebrate({ levelUps: r.levelUps });
        this.render(true);
        break;
      }
      case 'daily-claim': {
        const r = C.claimDaily(s, this.today());
        if (!r.ok) { this.toast(r.error, 'bad'); break; }
        sfx.badge(); confetti({ count: 160 });
        this.toast(`🔥 Day ${r.count} streak: +{{usd:${r.cash}}} and ${r.xp} XP`, 'gold');
        this.celebrate({ levelUps: r.levelUps });
        this.closeStart();
        this.render(true);
        break;
      }
      case 'start-play': this.closeStart(); break;
      case 'sound': setSound(!soundOn()); if (soundOn()) sfx.coin(); this.render(true); break;
      default: break;
    }
  }

  findOwned(uid) {
    return E.allOwned(this.state).find((o) => o.uid === uid) || this.state.racks.find((r) => r.uid === uid);
  }

  // ---------------------------------------------------------------- rendering

  render(force = false) {
    if (!force && (this.pointerDown || document.activeElement?.matches('input, select'))) return;
    this.room = E.roomStats(this.state);
    for (const g of E.checkGoals(this.state, this.room)) { this.toast(`🎯 Goal complete: ${g.title} (+{{usd:${g.reward}}})`, 'gold'); sfx.coin(); }
    if (!this.startOpen) this.celebrate(C.tick(this.state, this.room));
    this.renderHud();
    this.renderEvent();
    this.renderMain(force);
    this.renderSide();
  }

  renderNav() {
    $('#nav').innerHTML = NAV.map(([group, items]) => `<div class="nav-group">${group}</div>${items.map(([id, ico, label]) =>
      `<button class="nav-btn" data-action="nav" data-id="${id}" title="${label}"><span class="ico">${ico}</span>${label}</button>`).join('')}`).join('');
  }

  renderHud() {
    const s = this.state; const r = this.room || E.roomStats(s); const m = this.money;
    const c = C.ensure(s);
    const hosting = E.hostingPerDay(s);
    const profit = r.grossPerDay + hosting - r.demandWatts / 1000 * 24 * r.tariff * (r.offline ? 0 : 1);
    const reg = E.region(s);
    const shedding = reg.loadShedding && s.grid.stage > 0;
    const xpFrac = c.xp / C.xpToNext(c.level);
    const buffs = (s.buffs || []).filter((b) => b.untilDay > s.day);
    const tile = (label, value, cls = '', title = '') => `<div class="stat"${title ? ` title="${esc(title)}"` : ''}><span>${label}</span><b class="${cls}">${value}</b></div>`;
    $('#hud').innerHTML = `
      <div class="brand"><span class="logo">⬢</span><span class="word">HashForge</span></div>
      <button class="lvl" data-action="nav" data-id="career" title="${esc(C.rankOf(c.level))}: ${Math.round(c.xp)} / ${C.xpToNext(c.level)} XP">
        <span class="ring" style="--p:${(xpFrac * 100).toFixed(1)}"><b>${c.level}</b></span>
        <span class="lvl-text"><span class="rank">${esc(C.rankOf(c.level))}</span><span class="xpbar"><i style="width:${(xpFrac * 100).toFixed(1)}%"></i></span></span>
      </button>
      <div class="stat cash"><span>Cash</span><b id="hud-cash" class="${s.cash < 0 ? 'bad' : ''}">${m(this.cashShown ?? s.cash)}</b></div>
      ${tile('Profit / day', `${profit >= 0 ? '▲' : '▼'} ${m(Math.abs(profit))}`, profit >= 0 ? 'good' : 'bad')}
      ${s.clients?.length ? tile('Hosting / day', m(hosting), 'good', `Hosting income per day from ${s.clients.length} client(s)`) : ''}
      ${tile('Power', kw(r.demandWatts))}
      ${tile('Chips', `${r.minerWatts ? Math.round(r.deviceTemp) : Math.round(r.roomTemp)} °C`, r.deviceTemp > 85 ? 'bad' : r.deviceTemp > 75 ? 'warn' : '')}
      ${tile('Grid', r.offline ? 'DOWN' : shedding ? `Stage ${s.grid.stage}` : 'OK', r.offline ? 'bad' : shedding ? 'warn' : 'good')}
      ${tile(gameDate(s.day), `Day ${Math.floor(s.day) + 1}`)}
      ${s.prestige.forks ? tile('Era', `Fork ${s.prestige.forks}`, 'warn') : ''}
      ${buffs.length ? `<div class="buffs">${buffs.map((b) => `<span class="buff" title="${esc(b.label)}">${b.kind === 'hash' ? '⚡' : b.kind === 'tariff' ? '🔌' : '🏷️'} ${esc(b.label)} · ${Math.ceil(b.untilDay - s.day)}d</span>`).join('')}</div>` : ''}
      <div class="hud-right">
        <button class="icon-btn sound" data-action="sound" title="Sound ${soundOn() ? 'on' : 'off'}">${soundOn() ? '🔊' : '🔇'}</button>
        <div class="speed">${SPEEDS.map((sp, i) => `<button class="${i === this.speedIndex ? 'on' : ''}" data-action="speed" data-arg="${i}" title="${sp ? `${sp} game hours per second (key ${i})` : 'Pause (space)'}">${sp ? `${sp}×` : '❚❚'}</button>`).join('')}</div>
      </div>`;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('on', b.dataset.id === this.view));
    const ready = c.jobs.filter((j) => j.done).length;
    document.querySelectorAll('.nav-btn[data-id="career"]').forEach((b) => b.classList.toggle('ping', C.dailyAvailable(s, this.today()) || ready > 0));
  }

  renderMain(force) {
    // Avoid rebuilding the floor canvas every tick; other views refresh on a timer.
    const key = this.view + (this.view === 'shop' ? this.shopTab : '');
    if (!force && this.view === 'floor' && this.mainKey === key) { this.renderFloorDetails(); return; }
    if (!force && ['bench', 'settings', 'fork'].includes(this.view) && this.mainKey === key) return;
    this.mainKey = key;
    const html = {
      floor: () => this.viewFloor(), shop: () => this.viewShop(), used: () => this.viewUsed(), junk: () => this.viewJunk(),
      bench: () => this.viewBench(), inventory: () => this.viewInventory(), power: () => this.viewPower(),
      servers: () => this.viewServers(), clients: () => this.viewClients(),
      market: () => this.viewMarket(), fork: () => this.viewFork(), settings: () => this.viewSettings(), career: () => this.viewCareer(),
    }[this.view]();
    if (!force && html === this.lastMainHtml) return;   // nothing changed: keep the DOM (and any click in progress)
    this.lastMainHtml = html;
    const scroll = $('#main').scrollTop;
    $('#main').innerHTML = html;
    $('#main').scrollTop = scroll;
    if (this.view === 'floor') {
      this.floor = new FloorPlan($('#floor'), { onSelect: (pick) => this.onFloorSelect(pick), money: (v) => this.money(v, { precise: v < 10 }) });
      this.floor.selected = this.selection?.uid;
      this.renderFloorDetails();
    } else this.floor = null;
    if (this.view === 'market') this.drawCharts();
  }

  onFloorSelect(pick) {
    if (pick.type === 'shop') { this.view = 'shop'; this.shopTab = pick.tab; this.render(true); return; }
    if (pick.type === 'power') { this.view = 'power'; this.render(true); return; }
    if (pick.type === 'server') { this.view = 'servers'; this.serverSel = pick.uid; this.render(true); return; }
    this.selection = pick;
    if (this.floor) this.floor.selected = pick.uid;
    this.renderFloorDetails();
  }

  // ---------------------------------------------------------------- views

  viewFloor() {
    const s = this.state; const loc = E.location(s);
    return `
      <div class="page-head">
        <div><h1>${esc(loc.name)}</h1><div class="muted">${s.rigs.length}/${loc.rigSlots} rigs · ${s.racks.length}/${loc.rackSlots} racks · ${s.cooling.length}/${loc.coolingSlots} cooling · ${loc.circuitKw} kW circuit</div></div>
        <div class="row"><button class="btn" data-action="tour">🎥 3D Tour</button></div>
      </div>
      <div class="floor-wrap"><canvas id="floor"></canvas></div>
      <div class="legend"><span><i style="background:#5ee7ff"></i>Mining</span><span><i style="background:#ffd166"></i>Golden sample</span><span><i style="background:#3a4558"></i>Off</span><span><i style="background:#f87171"></i>Failed</span><span><i style="background:#16213a;border:1px solid #2b3d60"></i>Empty slot</span><span>Click anything to manage it</span></div>
      <div id="floor-detail" style="margin-top:14px"></div>`;
  }

  renderFloorDetails() {
    const el = $('#floor-detail');
    if (!el) return;
    const sel = this.selection;
    const s = this.state; const m = this.money;
    if (!sel) { const html = this.summaryCards(); if (html !== this.lastDetail) { this.lastDetail = html; el.innerHTML = html; } return; }
    this.lastDetail = null;
    if (sel.type === 'rig') {
      const rig = s.rigs.find((r) => r.uid === sel.uid);
      if (!rig) { this.selection = null; el.innerHTML = ''; return; }
      const st = E.rigStats(s, rig);
      el.innerHTML = `<div class="card"><div class="spread"><h3>${esc(rig.name)}: ${esc(byId[rig.frameId].name)}</h3>
        <div class="row"><button class="btn primary" data-action="open-rig" data-uid="${rig.uid}">🔧 Open in 3D workshop</button>
        <button class="btn" data-action="autofill" data-uid="${rig.uid}" title="Install the best GPUs, PSUs and a boot drive from your inventory">⚡ Auto-fill</button>
        <button class="btn" data-action="toggle" data-uid="${rig.uid}">${rig.on ? 'Switch off' : 'Switch on'}</button></div></div>
        <div class="kv" style="margin-top:8px">
          <span>Status</span><span class="${st.running ? 'good' : 'bad'}">${st.status.replace('-', ' ')}</span>
          <span>Slots</span><span>${rig.gpus.length} / ${byId[rig.frameId].slots} GPUs · ${rig.psus.length} / ${byId[rig.frameId].psuSlots} PSUs · ${rig.boot ? 'boot drive fitted' : '<span class="bad">no boot drive</span>'}</span>
          <span>Hashrate</span><span>${hashrate(st.potentialHashrate, st.unit)} on ${ALGOS[st.algo].name}</span>
          <span>PSU load</span><span class="${st.psuLoadPct > 1 ? 'bad' : st.psuLoadPct > 0.85 ? 'warn' : ''}">${Math.round(st.dcLoad)} W / ${st.psuCapacity} W (${Math.round(st.psuLoadPct * 100)}%)</span>
          <span>Wall power</span><span>${kw(st.dcLoad / st.efficiency)} at ${Math.round(st.efficiency * 100)}% efficiency</span>
          <span>Earning</span><span>${m(st.grossPerDay)} / day before power</span>
          <span>Algorithm</span><span><select data-change="algo" data-uid="${rig.uid}">${['auto', ...GPU_ALGOS].map((a) => `<option value="${a}" ${rig.algo === a ? 'selected' : ''}>${a === 'auto' ? 'Auto (most profitable)' : `${ALGOS[a].name} (${ALGOS[a].coin})`}</option>`).join('')}</select></span>
        </div></div>${this.rigPartsHtml(rig, st)}`;
    } else if (sel.type === 'rack') {
      const rack = s.racks.find((r) => r.uid === sel.uid);
      if (!rack) { this.selection = null; return; }
      const st = E.rackStats(s, rack);
      el.innerHTML = `<div class="card"><div class="spread"><h3>${esc(byId[rack.id].name)}</h3><span class="${st.overloaded ? 'bad' : 'muted'}">PDU ${kw(st.load)} / ${kw(st.pduLimit)}</span></div>
        <div class="grid" style="margin-top:8px">${rack.asics.map((a, i) => this.ownedCard(a, `<div class="small ${st.miners[i].running ? 'good' : 'bad'}">${st.miners[i].status}</div>
          <div class="row"><button class="btn" data-action="toggle" data-uid="${a.uid}">${a.on ? 'Off' : 'On'}</button>${this.repairBtn(a)}<button class="btn danger" data-action="sell" data-uid="${a.uid}">Sell</button></div>`)).join('') || '<div class="muted">Empty rack. Buy an ASIC miner from Vendors or the Used market.</div>'}</div>
        ${!rack.asics.length ? `<button class="btn danger" data-action="sell" data-uid="${rack.uid}" style="margin-top:8px">Sell rack</button>` : ''}</div>`;
    } else if (sel.type === 'cooling') {
      const c = s.cooling.find((x) => x.uid === sel.uid);
      if (!c) { this.selection = null; return; }
      const spec = byId[c.id];
      el.innerHTML = `<div class="card"><h3>${esc(spec.name)}</h3><div class="kv"><span>Removes</span><span>${kw(spec.cooling)} of heat</span><span>Draws</span><span>${kw(spec.power)}</span></div>
        <div class="row" style="margin-top:8px"><button class="btn" data-action="inspect" data-id="${c.id}" data-uid="${c.uid}">View in 3D</button><button class="btn danger" data-action="sell" data-uid="${c.uid}">Sell</button></div></div>`;
    }
  }

  summaryCards() {
    const r = this.room; const m = this.money;
    const algos = Object.entries(r.hashByAlgo);
    return `<div class="grid">
      <div class="card"><h3>Hashrate</h3>${algos.length ? algos.map(([a, h]) => `<div class="spread"><span>${ALGOS[a].name}</span><b class="mono">${hashrate(h, ALGOS[a].unit)}</b></div>`).join('') : '<div class="muted">Nothing mining yet.</div>'}</div>
      <div class="card"><h3>Today</h3><div class="kv"><span>Mining</span><span class="good">${m(r.grossPerDay)}/day</span>${this.state.clients?.length ? `<span>Hosting</span><span class="good">${m(E.hostingPerDay(this.state))}/day</span>` : ''}<span>Power</span><span class="bad">${m(r.demandWatts / 1000 * 24 * r.tariff)}/day</span><span>Net worth</span><span>${m(E.netWorth(this.state))}</span></div></div>
      <div class="card"><h3>Room</h3><div class="kv"><span>Dust</span><span class="${r.dust > 0.4 ? 'warn' : ''}">${Math.round(r.dust * 100)}% <button class="btn" style="padding:2px 8px" data-action="clean">Clean ${m(E.cleanCost(this.state))}</button></span><span>Room temp</span><span>${r.roomTemp.toFixed(1)} °C</span><span>Cooling</span><span>${kw(r.coolingCapacity)} of ${kw(r.minerWatts)} heat</span><span>Circuit</span><span class="${r.circuitPct > 0.9 ? 'bad' : ''}">${Math.round(r.circuitPct * 100)}%</span><span>Throttle</span><span class="${r.throttle < 1 ? 'warn' : ''}">${Math.round(r.throttle * 100)}%</span></div></div>
    </div>`;
  }

  /** Rigs a spare part could go into right now, best first (the selected rig, then the emptiest). */
  rigsWithRoom(kind) {
    const s = this.state;
    const room = (r) => kind === 'gpu' ? byId[r.frameId].slots - r.gpus.length : kind === 'psu' ? byId[r.frameId].psuSlots - r.psus.length : kind === 'boot' ? +!r.boot : 0;
    return s.rigs.filter((r) => room(r) > 0)
      .sort((a, b) => (b.uid === this.selection?.uid) - (a.uid === this.selection?.uid) || room(b) - room(a));
  }

  /** After a purchase, put parts straight into a rig or machine that has room. Returns its name or null. */
  autoInstall(uid) {
    const s = this.state;
    if (s.autoInstall === false || !uid) return null;
    const o = this.findOwned(uid);
    if (!o || o.broken || !s.inventory.includes(o)) return null;
    const spec = byId[o.id]; const kind = spec.kind;
    const buildingMachine = (this.view === 'shop' && ['components', 'pc'].includes(this.shopTab)) || this.view === 'servers' || !!this.buildFor;
    const tryRig = () => {
      const rig = this.rigsWithRoom(kind)[0];
      if (!rig) return null;
      const res = kind === 'gpu' ? E.installGpu(s, rig.uid, uid) : kind === 'psu' ? E.installPsu(s, rig.uid, uid) : kind === 'boot' ? E.installBoot(s, rig.uid, uid) : { ok: false };
      return res.ok ? rig.name : null;
    };
    const tryMachine = () => {
      const m = this.machinesFor(spec)[0];
      return m && E.installServerPart(s, m.uid, uid).ok ? m.name : null;
    };
    if (['board', 'cpu', 'ram', 'drive'].includes(kind)) return tryMachine();
    if (kind === 'psu') return buildingMachine ? tryMachine() || tryRig() : tryRig() || tryMachine();
    if (kind === 'gpu') return buildingMachine ? tryMachine() || tryRig() : tryRig();
    if (kind === 'boot') return tryRig();
    return null;
  }

  /** Machines a part would fit in right now, the one being built first. */
  machinesFor(part) {
    if (!SERVER_PARTS.includes(part.kind)) return [];
    const list = (this.state.servers || []).filter((m) => !E.serverPartProblem(m, part));
    const pref = this.buildFor || this.serverSel;
    return list.sort((a, b) => (b.uid === pref) - (a.uid === pref));
  }

  /** Two-click confirm without browser pop-ups: the first click arms the button for a few seconds. */
  confirmTwice(el, text) {
    if (!el) return true;
    if (el.dataset.armed === '1') return true;
    el.dataset.armed = '1';
    const old = el.textContent;
    el.textContent = text;
    el.classList.add('armed');
    clearTimeout(this.armTimer);
    this.armTimer = setTimeout(() => { el.dataset.armed = ''; el.textContent = old; el.classList.remove('armed'); }, 3500);
    this.pointerDown = true; setTimeout(() => { this.pointerDown = false; }, 3500);   // keep the armed button on screen
    return false;
  }

  /** Installed parts and matching inventory for a rig, so it can be built without opening 3D. */
  rigPartsHtml(rig, st) {
    const s = this.state;
    const frame = byId[rig.frameId];
    const algo = st.algo; const unit = ALGOS[algo].unit;
    const gpuInfo = (g) => { const e = E.gpuEffective(s, g); return { h: e.hash[algo] || 0, w: e.power }; };
    const row = (o, info, btn) => `<div class="part-row${o.broken ? ' dead' : ''}"><span class="name">${esc(byId[o.id].name)}</span>${this.gradeTag(o.q)}
      <span class="small muted">${info}</span><span class="small muted">${Math.round((o.cond ?? 1) * 100)}%${o.broken ? ' · <span class="bad">failed</span>' : ''}</span>${btn}</div>`;
    const gpuRow = (g, btn) => { const i = gpuInfo(g); return row(g, `${hashrate(i.h, unit)} · ${Math.round(i.w)} W`, btn); };
    const psuRow = (p, btn) => row(p, `${byId[p.id].watts} W · ${Math.round(E.psuEfficiency(p) * 100)}%`, btn);
    const bootRow = (b, btn) => row(b, esc(byId[b.id].style === 'usb' ? 'USB flash' : byId[b.id].style === 'nvme' ? 'M.2 NVMe' : 'SATA SSD'), btn);
    const remove = (o) => `<button class="btn small-btn" data-action="uninstall" data-arg="${rig.uid}" data-uid="${o.uid}">Remove</button>`;
    const add = (o, full, action = 'install', label = 'Add') => `<button class="btn primary small-btn" data-action="${action}" data-arg="${rig.uid}" data-uid="${o.uid}" ${full || o.broken ? 'disabled' : ''}>${label}</button>`;
    const gpusFull = rig.gpus.length >= frame.slots; const psusFull = rig.psus.length >= frame.psuSlots;
    const spareGpus = s.inventory.filter((o) => byId[o.id].kind === 'gpu').sort((a, b) => gpuInfo(b).h - gpuInfo(a).h);
    const sparePsus = s.inventory.filter((o) => byId[o.id].kind === 'psu').sort((a, b) => byId[b.id].watts - byId[a.id].watts);
    const spareBoot = s.inventory.filter((o) => byId[o.id].kind === 'boot');
    const empty = (t) => `<div class="small muted">${t}</div>`;
    return `<div class="parts-grid">
      <div class="card"><h3>In this rig</h3>
        <div class="part-head">GPUs ${rig.gpus.length}/${frame.slots}</div>${rig.gpus.map((g) => gpuRow(g, remove(g))).join('') || empty('No GPUs yet.')}
        <div class="part-head">PSUs ${rig.psus.length}/${frame.psuSlots}</div>${rig.psus.map((p) => psuRow(p, remove(p))).join('') || empty('No PSU: the rig has no power.')}
        <div class="part-head">Boot drive</div>${rig.boot ? bootRow(rig.boot, '') : empty('<span class="bad">None: the rig cannot boot.</span>')}
      </div>
      <div class="card"><h3>Available in inventory</h3>
        <div class="part-head">GPUs (${spareGpus.length})${gpusFull ? ' · rig full' : ''}</div>${spareGpus.map((g) => gpuRow(g, add(g, gpusFull))).join('') || empty('No spare GPUs. Buy some from Vendors, Used or build one on the Workbench.')}
        <div class="part-head">PSUs (${sparePsus.length})${psusFull ? ' · PSU slots full' : ''}</div>${sparePsus.map((p) => psuRow(p, add(p, psusFull))).join('') || empty('No spare PSUs.')}
        <div class="part-head">Boot drives (${spareBoot.length})</div>${spareBoot.map((b) => bootRow(b, add(b, false, 'install-boot', rig.boot ? 'Swap' : 'Add'))).join('') || empty('No spare boot drives.')}
      </div></div>`;
  }

  gradeTag(q) {
    return `<span class="grade" style="color:${QUALITY[q || 'new'].color}">${QUALITY[q || 'new'].name}</span>`;
  }

  repairBtn(o) {
    if (!o.broken && (o.cond ?? 1) >= 0.99) return '';
    return `<button class="btn" data-action="repair" data-uid="${o.uid}">${o.broken ? 'Repair' : 'Service'} ${this.money(E.repairCost(this.state, o))}</button>`;
  }

  modButtons(gpu) {
    if (byId[gpu.id].kind !== 'gpu') return '';
    const kits = this.state.inventory.filter((x) => byId[x.id].kind === 'mod');
    const mods = gpu.mods || {};
    const btns = [];
    const labels = { pads: '🧊 Re-pad', shim: '🟧 Copper shims', paste: '🧴 Re-paste', fans: '🌀 New fans' };
    for (const id of Object.keys(labels)) {
      if (mods[id]) continue;
      if (id === 'fans' && (gpu.cond ?? 1) >= 0.99) continue;
      const kit = kits.find((k) => k.id === id);
      if (kit && (!byId[id].needs || mods[byId[id].needs])) btns.push(`<button class="btn" data-action="mod" data-uid="${gpu.uid}" data-arg="${kit.uid}">${labels[id]}</button>`);
    }
    return btns.join('');
  }

  modTags(gpu) {
    const m = gpu.mods || {};
    return `${m.pads ? '<span class="tag">Fresh pads</span>' : ''}${m.shim ? '<span class="tag">Copper shims</span>' : ''}${m.paste ? '<span class="tag">Re-pasted</span>' : ''}${byId[gpu.id].mem === 'GDDR6X' && !m.pads ? '<span class="tag warn">Memory throttling</span>' : ''}`;
  }

  ownedCard(o, actions = '') {
    const spec = byId[o.id];
    return `<div class="card product"><div class="spread"><span class="name">${esc(spec.name)}</span>${this.gradeTag(o.q)}</div>
      <div class="small muted">Condition ${Math.round((o.cond ?? 1) * 100)}%${o.broken ? ' · <span class="bad">FAILED</span>' : ''}${o.crafted ? ' · hand-built' : ''}</div>
      ${spec.kind === 'gpu' ? `<div class="row">${this.modTags(o)}</div>` : ''}
      <div class="bar"><i style="width:${Math.round((o.cond ?? 1) * 100)}%"></i></div>${actions}</div>`;
  }

  specLines(item, grade = 'new') {
    const s = this.state; const m = this.money;
    if (item.kind === 'gpu') {
      const e = E.gpuEffective(s, { id: item.id, q: grade, cond: 1 });
      const est = E.itemDailyEstimate(s, item, grade);
      const max = Math.max(...GPU_ALGOS.map((a) => est.byAlgo[a]));
      return `<div class="kv"><span>VRAM</span><span>${item.vram} GB ${item.mem}</span><span>Power</span><span>${Math.round(e.power)} W tuned (${item.tdp} W stock)</span></div>
        <div class="bars">${GPU_ALGOS.map((a) => `<div class="spread small"><span>${ALGOS[a].name}</span><span class="mono">${hashrate(e.hash[a], 'MH/s')} · ${m(est.byAlgo[a])}/d</span></div><div class="bar"><i style="width:${Math.max(4, (est.byAlgo[a] / max) * 100)}%;background:${ALGOS[a].color}"></i></div>`).join('')}</div>
        <div class="small">Net after power: <b class="${est.profit >= 0 ? 'good' : 'bad'}">${m(est.profit)}/day</b></div>`;
    }
    if (item.kind === 'asic') {
      const est = E.itemDailyEstimate(s, item, grade);
      return `<div class="kv"><span>Algorithm</span><span>${ALGOS[item.algo].name} (${ALGOS[item.algo].coin})</span><span>Hashrate</span><span>${hashrate(item.hashrate, ALGOS[item.algo].unit)}</span>
        <span>Power</span><span>${kw(item.power)}</span><span>Efficiency</span><span>${(item.power / item.hashrate).toFixed(1)} W/${ALGOS[item.algo].unit.replace('/s', '')}</span></div>
        <div class="small">Net after power: <b class="${est.profit >= 0 ? 'good' : 'bad'}">${m(est.profit)}/day</b></div>`;
    }
    const lines = {
      psu: () => [['Output', `${item.watts} W`], ['Efficiency', `${Math.round(item.efficiency * 100)}% (80 Plus ${item.rating})`]],
      frame: () => [['GPU slots', item.slots], ['PSU slots', item.psuSlots], ['Base load', `${item.basePower} W`]],
      rack: () => [['Miner slots', item.units], ['PDU limit', `${item.pduKw} kW`]],
      cooling: () => [['Removes', kw(item.cooling)], ['Draws', kw(item.power)]],
      inverter: () => [['Output', `${item.kw} kW`], ['Efficiency', `${Math.round(item.efficiency * 100)}%`]],
      battery: () => [['Capacity', `${item.kwh} kWh`], ['Max output', `${item.maxKw} kW`], ['Cycle life', `${item.cycles.toLocaleString()} cycles`]],
      solar: () => [['Peak output', `${item.kwp} kWp`], ['Note', 'Needs an inverter']],
      generator: () => [['Output', `${item.kw} kW`], ['Diesel', `${item.litresPerKwh} L/kWh`]],
      riser: () => [['Power input', item.power], ['Reliability', item.reliability <= 0.5 ? 'Excellent' : item.reliability <= 1 ? 'Average' : 'Poor'], ...(item.fireRisk ? [['⚠ Warning', 'SATA connectors are rated below what a card can pull: fire risk']] : [])],
      boot: () => [['Capacity', `${item.gb} GB`], ['Reliability', item.reliability <= 0.5 ? 'Excellent' : item.reliability <= 1 ? 'Good' : 'Fair (flash wears out)']],
      mod: () => [['Effect', item.desc]],
      case: () => {
        const b = item.board;
        return [
          ['Type', { nuc: 'Mini PC (barebone)', nas: 'NAS appliance', tower: 'PC case', rack: `${item.rackU}U rack server` }[item.type]],
          ...(b ? [[b.form === 'integrated' ? 'CPU' : 'Board', b.form === 'integrated' ? `${b.cpu} · ${b.cores}C/${b.threads}T` : `${b.cpuSockets}× ${b.socket} socket`],
            ['Memory', `${b.ramSlots}× ${b.ramType}${b.ramBuiltin ? ` (${b.ramBuiltin} GB fitted)` : ''}, max ${b.maxRam} GB`]] : [['Motherboard', (item.forms || []).map((f) => f.toUpperCase()).join(' / ')]]),
          ['Drive bays', [item.bays35 && `${item.bays35}× 3.5"`, item.bays25 && `${item.bays25}× 2.5"`, b?.m2 && `${b.m2}× M.2`].filter(Boolean).join(' · ') || 'M.2 only'],
          ['Power supply', item.psu ? `Built in, ${item.psu.watts} W` : 'Add your own PSU'],
          ...(item.sas ? [['Extras', 'SAS backplane']] : []), ...(item.gpuSlots ? [['GPU slots', item.gpuSlots]] : []),
        ];
      },
      board: () => [['Socket', `${item.cpuSockets > 1 ? `${item.cpuSockets}× ` : ''}${item.socket}`], ['Form factor', item.form.toUpperCase()], ['Memory', `${item.ramSlots}× ${item.ramType}, max ${item.maxRam} GB`], ['Storage', `${item.m2}× M.2 · ${item.sata}× SATA`]],
      cpu: () => [['Socket', item.socket], ['Cores / threads', `${item.cores} / ${item.threads}`], ['Power', `${item.watts} W TDP`]],
      ram: () => [['Type', item.type.replace('-SO', ' SO-DIMM').replace('-ECC', ' ECC')], ['Size', `${item.gb} GB`]],
      drive: () => [['Capacity', E.fmtTb(item.tb)], ['Interface', `${item.iface.toUpperCase()}${item.size === 'm2' ? ' (M.2)' : ` · ${item.size}"`}`], ['Class', `${DRIVE_CLASS[item.cls].name}: ${DRIVE_CLASS[item.cls].note}`], ['Power', `${item.watts} W`]],
      ups: () => [['Battery', `${item.wh} Wh`], ['Max load', `${item.maxW} W`], ['Runtime', `~${Math.round(item.wh / 150 * 60)} min at 150 W · ~${Math.round(item.wh / 600 * 60)} min for a 600 W rig`], ['Covers', 'Servers first, then mining rigs and ASICs with what is left']],
    }[item.kind];
    return lines ? `<div class="kv">${lines().map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>` : '';
  }

  viewShop() {
    const s = this.state; const m = this.money;
    const tabs = `<div class="tabs">${SHOP_TABS.map(([id, label]) => `<button class="${id === this.shopTab ? 'on' : ''}" data-action="shop-tab" data-id="${id}">${label}</button>`).join('')}</div>`;
    if (this.shopTab === 'location') {
      const cur = LOCATIONS.indexOf(E.location(s));
      const fac = s.facility?.[s.location] || {};
      const facHtml = `<h3 style="margin:18px 0 8px">Facility upgrades: ${esc(E.location(s).name)}</h3><div class="grid">${FACILITY.map((f) => `<div class="card product"><span class="name">${esc(f.name)}</span><div class="small muted">${esc(f.desc)}</div>
        <div class="spread"><span class="price">${m(E.facilityPrice(s, f.id))}</span>${fac[f.id] ? '<span class="tag">Installed</span>' : `<button class="btn primary" data-action="facility" data-id="${f.id}">Install</button>`}</div></div>`).join('')}</div>`;
      return `<div class="page-head"><h1>Vendors</h1>${tabs}</div>${facHtml}<h3 style="margin:18px 0 8px">Locations</h3><div class="grid">${LOCATIONS.map((l, i) => `
        <div class="card product"><span class="name">${esc(l.name)}</span>
        <div class="kv"><span>Rigs / racks</span><span>${l.rigSlots} / ${l.rackSlots}</span><span>Circuit</span><span>${l.circuitKw} kW</span><span>Power price</span><span>${l.tariffMult === 1 ? 'Home tariff' : `${Math.round((1 - l.tariffMult) * 100)}% cheaper`}</span><span>Roof for solar</span><span>${l.roofKwp} kWp</span><span>Ambient</span><span>${l.ambient} °C</span></div>
        <div class="price">${l.price ? m(l.price * E.effects(s).price) : 'Free'}</div>
        ${i === cur ? '<span class="tag">You are here</span>' : i < cur ? '<span class="tag">Outgrown</span>' : `<button class="btn primary" data-action="move" data-id="${l.id}">Move here</button>`}</div>`).join('')}</div>`;
    }
    let items = SHOP_TABS.find(([id]) => id === this.shopTab)[2];
    let subbar = '';
    if (this.shopTab === 'components') {
      const kind = this.compKind || 'all';
      if (kind !== 'all') items = items.filter((it) => it.kind === kind);
      const target = this.buildFor && s.servers.find((x) => x.uid === this.buildFor);
      if (target) items = items.filter((it) => !E.serverPartProblem(target, it));
      subbar = `<div class="row" style="margin-bottom:10px">${COMPONENT_KINDS.map(([k, l]) => `<button class="chip ${kind === k ? 'on' : ''}" data-action="comp-kind" data-id="${k}">${l}</button>`).join('')}
        ${s.servers.length ? `<label class="row small" style="margin-left:auto"><input type="checkbox" data-action="fit-only" ${target ? 'checked' : ''}> Only show parts that fit ${target ? esc(target.name) : 'my machine'}</label>` : ''}</div>`;
    }
    const f = (this.shopFilter || '').toLowerCase();
    if (f) items = items.filter((it) => `${it.name} ${it.gen || ''} ${it.maker || ''} ${it.vendor || ''} ${it.algo ? ALGOS[it.algo].name : ''}`.toLowerCase().includes(f));
    if (['gpu', 'asic'].includes(this.shopTab)) {
      const sort = this.shopSort || 'profit';
      const est = (it) => E.itemDailyEstimate(s, it)?.profit ?? 0;
      items = [...items].sort((a, b) => sort === 'price' ? E.buyPrice(s, a) - E.buyPrice(s, b) : sort === 'newest' ? b.year - a.year
        : sort === 'roi' ? (est(b) / E.buyPrice(s, b)) - (est(a) / E.buyPrice(s, a)) : est(b) - est(a));
    }
    const toolbar = `<div class="row" style="margin-bottom:12px"><input type="search" placeholder="Search ${items.length} items… (e.g. RTX 30, Antminer, Kaspa)" value="${esc(this.shopFilter || '')}" data-change="shop-filter" style="flex:1;min-width:220px">
      ${['gpu', 'asic'].includes(this.shopTab) ? `<select data-change="shop-sort">${[['profit', 'Most profit / day'], ['roi', 'Best return on cost'], ['price', 'Cheapest'], ['newest', 'Newest']].map(([v, l]) => `<option value="${v}" ${(this.shopSort || 'profit') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>`;
    return `<div class="page-head"><div><h1>Vendors</h1><div class="muted">Brand new, full warranty, full price. Click any item to inspect it in 3D.</div></div>${tabs}</div>${toolbar}${subbar}
      <div class="grid">${items.map((it) => `<div class="card product">
        <div class="spread"><span class="name">${esc(it.name)}</span>${it.year ? `<span class="tag">${it.year}</span>` : ''}</div>
        ${this.specLines(it)}
        <div class="spread"><span class="price">${m(E.buyPrice(s, it))}</span>
        <div class="row"><button class="btn" data-action="inspect" data-id="${it.id}">3D</button><button class="btn primary" data-action="buy" data-id="${it.id}" ${s.cash < E.buyPrice(s, it) ? 'disabled' : ''}>Buy</button></div></div></div>`).join('')}</div>
      <p class="disclaimer">Product names identify real hardware and belong to their owners. HashForge is not affiliated with any manufacturer. Figures are approximate.</p>`;
  }

  viewUsed() {
    const s = this.state; const m = this.money;
    return `<div class="page-head"><div><h1>Used Marketplace</h1><div class="muted">Second-hand listings change daily. Cheaper, but check the grade and condition.</div></div></div>
      <div class="grid">${s.listings.map((l) => {
        const it = byId[l.itemId];
        const daysLeft = Math.max(0, Math.ceil(l.expires - s.day));
        return `<div class="card product"><div class="spread"><span class="name">${esc(it.name)}</span>${this.gradeTag(l.q)}</div>
          <div class="small muted">Condition ${Math.round(l.cond * 100)}% · listing ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</div>
          ${this.specLines(it, l.q)}
          <div class="spread"><span class="price">${m(l.price)} <span class="small muted" style="text-decoration:line-through">${m(E.buyPrice(s, it))}</span></span>
          <div class="row"><button class="btn" data-action="inspect" data-id="${it.id}">3D</button><button class="btn primary" data-action="buy-listing" data-id="${l.id}" ${s.cash < l.price ? 'disabled' : ''}>Buy</button></div></div></div>`;
      }).join('')}</div>`;
  }

  viewJunk() {
    const s = this.state; const m = this.money;
    return `<div class="page-head"><div><h1>Junkyard</h1><div class="muted">Buy a lot, then see what's inside: scrap, parts, whole cards, and the odd golden sample. Lots opened: ${s.stats.lotsOpened}.</div></div></div>
      <div class="grid">${JUNK_LOTS.map((l) => {
        const total = l.grades.reduce((a, b) => a + b, 0);
        return `<div class="card product"><span class="name">${esc(l.name)}</span><div class="muted small">${esc(l.blurb)}</div>
          <div class="kv"><span>Items</span><span>${l.parts[0]}–${l.parts[1]}</span><span>Newest hardware</span><span>${l.newestYear}</span></div>
          <div class="bars">${['scrap', 'used', 'refurb', 'new', 'golden'].map((q, i) => `<div class="spread small"><span style="color:${QUALITY[q].color}">${QUALITY[q].name}</span><span>${((l.grades[i] / total) * 100).toFixed(1)}%</span></div>`).join('')}</div>
          <div class="spread"><span class="price">${m(l.price * E.effects(s).price)}</span><button class="btn primary" data-action="buy-lot" data-id="${l.id}" ${s.cash < l.price ? 'disabled' : ''}>Buy & open</button></div></div>`;
      }).join('')}</div>`;
  }

  viewBench() {
    const s = this.state; const m = this.money;
    const cores = s.parts.filter((p) => p.type === 'core');
    const opts = this.bench.core ? E.compatibleParts(s, this.bench.core) : null;
    if (this.bench.core && !opts) this.bench = {};
    const pickList = (type, list) => list.length ? list.map((p) => `<button class="part-pick ${this.bench[type] === p.uid ? 'on' : ''}" data-action="bench-pick" data-arg="${type}" data-uid="${p.uid}">
        <div class="spread"><span>${esc(E.partLabel(p))}</span>${this.gradeTag(p.q)}</div></button>`).join('') : '<div class="muted small">None that fit. Try the junkyard.</div>';
    const ready = opts && this.bench.memory && this.bench.pcb && this.bench.cooler;
    const loose = s.parts.filter((p) => p.type !== 'core');
    return `<div class="page-head"><div><h1>Workbench</h1><div class="muted">Pick a GPU core, then matching memory, PCB and cooler. Better parts make a better card; great parts can make a golden sample. Workshop fee ${m(CRAFT_FEE)}.</div></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
        <div class="card"><h3>1. GPU core (${cores.length})</h3><div class="bars">${pickList('core', cores)}</div></div>
        ${opts ? `<div class="card"><h3>2. Memory: ${opts.model.vram} GB ${opts.model.mem}</h3><div class="bars">${pickList('memory', opts.memory)}</div></div>
        <div class="card"><h3>3. PCB: ${opts.model.gen}</h3><div class="bars">${pickList('pcb', opts.pcb)}</div></div>
        <div class="card"><h3>4. Cooler: ${opts.model.fans}+ fans</h3><div class="bars">${pickList('cooler', opts.cooler)}</div></div>` : ''}
      </div>
      ${opts ? `<div class="row" style="margin:14px 0"><button class="btn primary" data-action="craft" ${ready ? '' : 'disabled'}>🔩 Assemble ${esc(opts.model.name)}</button><button class="btn" data-action="inspect" data-id="${opts.model.id}">Preview in 3D</button></div>` : ''}
      <h3 style="margin:18px 0 8px">Loose parts (${loose.length})</h3>
      <div class="grid">${loose.map((p) => `<div class="card product"><div class="spread"><span>${esc(E.partLabel(p))}</span>${this.gradeTag(p.q)}</div>
        <div class="small muted">From a ${esc(byId[p.model].name)}</div>
        <div class="spread"><span>${m(E.partValue(s, p))}</span><button class="btn" data-action="sell-part" data-uid="${p.uid}">Sell</button></div></div>`).join('') || '<div class="muted">No loose parts. Open a junkyard lot or salvage a card from your Inventory.</div>'}</div>`;
  }

  viewInventory() {
    const s = this.state;
    const inv = s.inventory;
    return `<div class="page-head"><div><h1>Inventory</h1><div class="muted">Hardware that isn't installed yet. Install it here, or click a rig on the Floor.</div></div>
      <label class="row small"><input type="checkbox" data-action="auto-install" ${s.autoInstall !== false ? 'checked' : ''}> Install new GPUs, PSUs and boot drives into a rig automatically</label></div>
      <div class="grid">${inv.map((o) => {
        const spec = byId[o.id];
        const targets = ['gpu', 'psu', 'boot'].includes(spec.kind) && !o.broken ? this.rigsWithRoom(spec.kind) : [];
        const machines = !o.broken ? this.machinesFor(spec) : [];
        return this.ownedCard(o, `${targets.length || machines.length ? `<div class="row">${targets.slice(0, 3).map((r) => `<button class="btn primary" data-action="install-to" data-arg="${r.uid}" data-uid="${o.uid}">Install in ${esc(r.name)}</button>`).join('')}${machines.slice(0, 3).map((m) => `<button class="btn primary" data-action="srv-add" data-arg="${m.uid}" data-uid="${o.uid}">Fit in ${esc(m.name)}</button>`).join('')}</div>` : ''}<div class="row">
          <button class="btn" data-action="inspect" data-id="${o.id}" data-uid="${o.uid}">3D</button>
          ${this.repairBtn(o)}
          ${spec.kind === 'gpu' ? `${this.modButtons(o)}<button class="btn" data-action="salvage" data-uid="${o.uid}">Salvage</button>` : ''}
          <button class="btn danger" data-action="sell" data-uid="${o.uid}">Sell ${this.money(E.sellValue(s, o))}</button></div>`);
      }).join('') || '<div class="muted">Nothing in storage.</div>'}</div>`;
  }

  viewPower() {
    const s = this.state; const m = this.money; const r = this.room;
    const cap = E.energyCapacity(s);
    const reg = E.region(s);
    const sched = E.sheddingSchedule(s, 24);
    const hour = s.hours % 24;
    const bill = s.lastBill;
    return `<div class="page-head"><div><h1>Power</h1><div class="muted">${esc(reg.name)} · tariff ${m(s.tariffLocal / s.fx, { precise: true })}/kWh at home${r.location.tariffMult < 1 ? `, ${m(E.tariffUsd(s), { precise: true })}/kWh here` : ''}${this.fxLive ? ' · live exchange rate' : ''}</div></div>
      ${r.tripped ? '<button class="btn primary" data-action="reset-breaker">Reset breaker</button>' : ''}</div>
      <div class="grid">
        <div class="card"><h3>Grid</h3><div class="kv">
          <span>Status</span><span class="${r.offline ? 'bad' : 'good'}">${r.offline ? `Down: ${esc(r.offlineReason)}` : 'Supplying'}</span>
          ${reg.loadShedding ? `<span>Load-shedding</span><span class="${s.grid.stage ? 'warn' : 'good'}">${s.grid.stage ? `Stage ${s.grid.stage}: ${E.SHED_BLOCKS[s.grid.stage] * 2} h/day` : 'Suspended'}</span>` : ''}
          <span>Circuit</span><span class="${r.circuitPct > 0.9 ? 'bad' : ''}">${kw(r.demandWatts)} of ${r.location.circuitKw} kW</span>
          ${s.region === 'za' ? `<span>Tariff plan</span><span><select data-change="tariff-plan"><option value="standard" ${s.tariffPlan !== 'daytime' ? 'selected' : ''}>Standard</option><option value="daytime" ${s.tariffPlan === 'daytime' ? 'selected' : ''}>Daytime surplus (cheap 06-18h)</option></select></span>` : ''}</div>
          ${reg.loadShedding ? `<div class="small muted" style="margin:8px 0 4px">Next 24 hours</div><div class="shed">${sched.map((off, i) => `<i class="${off ? 'off' : ''} ${i === 0 ? 'now' : ''}" title="${(hour + i) % 24}:00"></i>`).join('')}</div>` : ''}</div>
        <div class="card"><h3>Backup & solar</h3><div class="kv">
          <span>Inverter</span><span class="${cap.inverterKw && cap.inverterKw < r.demandWatts / 1000 ? 'bad' : ''}">${cap.inverterKw ? `${cap.inverterKw} kW` : 'None'}</span>
          <span>Batteries</span><span>${cap.batteryKwh ? `${cap.batteryStored.toFixed(1)} / ${cap.batteryKwh.toFixed(1)} kWh` : 'None'}</span>
          <span>Solar</span><span>${cap.solarKwp ? `${cap.solarKwp} kWp · ${(cap.solarKwp * E.sunFactor(s)).toFixed(1)} kW now` : 'None'}</span>
          <span>Weather</span><span>${s.weather >= 1 ? '☀️ Sunny' : s.weather > 0.5 ? '⛅ Partly cloudy' : '☁️ Overcast'}</span>
          <span>Generator</span><span>${cap.generatorKw ? `${cap.generatorKw} kW` : 'None'}</span>
          <span>UPS</span><span>${(s.energy.ups || []).length ? `${Math.round(s.energy.ups.reduce((t, u) => t + u.charge, 0))} Wh ready` : 'None'}</span></div>
          ${cap.batteries.length ? `<label class="row small" style="margin-top:8px"><input type="checkbox" data-action="grid-charge" ${s.energy.gridCharge ? 'checked' : ''}> Charge batteries from the grid</label>` : ''}
          <button class="btn" style="margin-top:8px" data-action="nav" data-id="shop" onclick="window.hf.shopTab='energy'">Buy solar & backup</button></div>
        <div class="card"><h3>This month</h3><div class="kv">
          <span>Grid energy</span><span>${Math.round(s.power.gridKwh).toLocaleString()} kWh</span>
          <span>Grid cost</span><span>${m(s.power.gridCost)}</span><span>Diesel</span><span>${m(s.power.dieselCost)}</span>
          <span>Bill due</span><span>Day ${Math.floor(s.power.lastBillDay + 30) + 1}</span></div>
          ${bill ? `<div class="small muted" style="margin-top:8px">Last bill: ${Math.round(bill.kwh).toLocaleString()} kWh, ${m(bill.total)}</div>` : ''}</div>
      </div>
      ${this.energyGearHtml()}`;
  }

  /** Every inverter, battery, solar array and generator, with 3D and Sell buttons. */
  energyGearHtml() {
    const s = this.state; const m = this.money;
    const groups = [['Inverters', s.energy.inverters], ['Batteries', s.energy.batteries], ['Solar', s.energy.solar], ['Generators', s.energy.generators], ['UPS units', s.energy.ups || []]];
    const detail = (o) => {
      const spec = byId[o.id];
      if (spec.kind === 'battery') return `${spec.kwh} kWh · ${Math.round((1 - (o.wear || 0)) * 100)}% capacity left · ${((o.soc || 0)).toFixed(1)} kWh stored`;
      if (spec.kind === 'inverter') return `${spec.kw} kW · ${Math.round(spec.efficiency * 100)}% efficient${o.broken ? ' · <span class="bad">failed</span>' : ''}`;
      if (spec.kind === 'solar') return `${spec.kwp} kWp`;
      if (spec.kind === 'ups') return `${spec.maxW} W max · ${Math.round(o.charge || 0)} / ${spec.wh} Wh charged`;
      return `${spec.kw} kW`;
    };
    const rows = groups.filter(([, list]) => list.length).map(([title, list]) => `<div class="part-head">${title}</div>${list.map((o) => `<div class="part-row gear">
      <span class="name">${esc(byId[o.id].name)}</span><span class="small muted">${detail(o)}</span>
      <button class="btn small-btn" data-action="inspect" data-id="${o.id}" data-uid="${o.uid}">3D</button>
      <button class="btn danger small-btn" data-action="sell" data-uid="${o.uid}">Sell ${m(E.sellValue(s, o))}</button></div>`).join('')}`).join('');
    return `<div class="card" style="margin-top:12px"><h3>Your power equipment</h3>${rows || '<div class="small muted">No inverters, batteries, solar or generators yet.</div>'}</div>`;
  }

  viewMarket() {
    const s = this.state; const m = this.money;
    return `<div class="page-head"><div><h1>Market</h1><div class="muted">Simulated prices: ${s.market.regime} market. Difficulty follows price with a lag: bull runs pay well until miners pile in, slumps hurt until they unplug. Halvings cut SHA-256 rewards.</div></div></div>
      <div class="grid">${Object.entries(ALGOS).map(([a, al]) => {
        const h = s.market.history[a];
        const change = h.length > 7 ? (h[h.length - 1] / h[h.length - 8] - 1) * 100 : 0;
        return `<div class="card"><div class="spread"><h3 style="color:${al.color}">${al.coin}</h3><span class="muted small">${al.name}</span></div>
          <div class="spread"><b class="mono" style="font-size:18px">${m(E.coinPrice(s, a), { precise: E.coinPrice(s, a) < 10 })}</b><span class="${change >= 0 ? 'good' : 'bad'}">${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}% 7d</span></div>
          <canvas class="spark" data-algo="${a}" height="60" style="width:100%;height:60px"></canvas>
          <div class="small muted">Pays ${m(E.revenuePerUnit(s, a), { precise: true })}/day per ${al.unit} · difficulty ×${s.market.difficulty[a].toFixed(2)}</div></div>`;
      }).join('')}</div>`;
  }

  drawCharts() {
    document.querySelectorAll('canvas.spark').forEach((c) => {
      const h = this.state.market.history[c.dataset.algo];
      const ctx = c.getContext('2d');
      c.width = c.clientWidth * 2; c.height = 120;
      const min = Math.min(...h); const max = Math.max(...h);
      ctx.strokeStyle = ALGOS[c.dataset.algo].color; ctx.lineWidth = 3;
      ctx.beginPath();
      h.forEach((v, i) => {
        const x = (i / Math.max(1, h.length - 1)) * c.width;
        const y = c.height - 8 - ((v - min) / Math.max(1e-9, max - min)) * (c.height - 16);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  }

  viewFork() {
    const s = this.state; const m = this.money; const p = s.prestige;
    const worth = E.netWorth(s);
    const goal = forkThreshold(p.forks);
    const reward = forkReward(worth, p.forks);
    return `<div class="page-head"><div><h1>Hard Fork</h1><div class="muted">Reset your operation for Fork Shards. Shards buy permanent upgrades that never reset. Each fork starts a harder era.</div></div></div>
      <div class="grid">
        <div class="card"><h3>Era ${p.forks}</h3><div class="kv"><span>Net worth</span><span>${m(worth)}</span><span>Fork at</span><span>${m(goal)}</span><span>Reward now</span><span class="warn">${reward} shards</span><span>Shards</span><span>${p.shards} (lifetime ${p.lifetimeShards})</span></div>
          <div class="bar" style="margin:10px 0"><i style="width:${Math.min(100, (worth / goal) * 100)}%"></i></div>
          <button class="btn primary" data-action="fork" ${E.canFork(s) ? '' : 'disabled'}>🔱 Hard Fork</button></div>
      </div>
      <h3 style="margin:18px 0 8px">Permanent upgrades</h3>
      <div class="grid">${UPGRADES.map((u) => {
        const lvl = p.upgrades[u.id] || 0; const cost = upgradeCost(u, lvl);
        return `<div class="card product"><div class="spread"><span class="name">${esc(u.name)}</span><span class="tag">Lv ${lvl}</span></div>
          <div class="small muted">${esc(u.desc)}</div>
          <button class="btn ${p.shards >= cost ? 'primary' : ''}" data-action="upgrade" data-id="${u.id}" ${p.shards >= cost ? '' : 'disabled'}>Upgrade: ${cost} shards</button></div>`;
      }).join('')}</div>`;
  }

  // ---------------------------------------------------------------- servers

  partSpecs(m) {
    const spec = (o) => (o ? { ...byId[o.id], broken: o.broken } : null);
    return { board: m.board ? byId[m.board.id] : byId[m.id].board ? { ...byId[m.id].board } : null, cpus: m.cpus.map(spec), ram: m.ram.map(spec), drives: m.drives.map(spec), gpus: (m.gpus || []).map(spec), psu: spec(m.psu) };
  }

  openMachine(uid) {
    const m = this.state.servers.find((x) => x.uid === uid);
    if (!m) return;
    const p = this.partSpecs(m);
    this.openViewer(byId[m.id], { uid: m.uid, q: 'new', cond: 1, on: m.on, parts: { ...p, board: m.board ? byId[m.board.id] : null } });
  }

  meter(label, used, total, fmt = (v) => v) {
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return `<div class="meter"><div class="spread small"><span class="muted">${label}</span><span class="mono">${fmt(used)} / ${fmt(total)}</span></div>
      <div class="bar"><i style="width:${pct}%;${pct > 90 ? 'background:var(--warn)' : ''}"></i></div></div>`;
  }

  viewServers() {
    const s = this.state; const m = this.money; const loc = E.location(s);
    const room = this.room || E.roomStats(s);
    const cards = s.servers.map((sv, i) => {
      const st = room.servers[i] || E.serverStats(s, sv);
      const spec = byId[sv.id];
      const sel = this.serverSel === sv.uid;
      const pill = st.running ? (st.status === 'degraded' ? 'warn' : 'good') : st.status === 'off' ? 'muted' : 'bad';
      return `<div class="card machine ${sel ? 'sel' : ''}">
        <div class="spread"><div><div class="name">${esc(sv.name)}</div><div class="small muted">${esc(spec.name)}</div></div><span class="pill ${pill}">${esc(E.SERVER_STATUS[st.status])}</span></div>
        <div class="meters">
          ${this.meter('CPU threads', st.used.vcpu, st.vcpu)}
          ${this.meter('Memory', st.used.ramGB, st.ramGB, (v) => `${v} GB`)}
          ${this.meter(`Storage${st.raid ? ' (protected)' : ''}`, st.used.tb, st.usableTb, (v) => E.fmtTb(v))}
        </div>
        <div class="kv small"><span>Clients</span><span>${st.clients.length} · <b class="good">${m(st.payPerDay)}/day</b></span><span>Power</span><span>${Math.round(st.wallPower)} W${st.psuWatts ? ` of ${st.psuWatts} W PSU` : ''}</span>
          <span>OS</span><span>${SERVER_OS[sv.os || 'linux'].name}</span></div>
        <div class="row">
          <button class="btn ${sel ? '' : 'primary'}" data-action="srv-select" data-uid="${sv.uid}">${sel ? 'Close' : '🔧 Build & manage'}</button>
          <button class="btn" data-action="srv-3d" data-uid="${sv.uid}">3D</button>
          <button class="btn" data-action="srv-toggle" data-uid="${sv.uid}">${sv.on ? 'Shut down' : 'Power on'}</button>
        </div></div>`;
    }).join('');
    const selM = s.servers.find((x) => x.uid === this.serverSel);
    const empty = !s.servers.length ? `<div class="card hero"><h3>Start a side business</h3>
      <p class="muted">Build a PC, mini PC, NAS or rack server and host websites, game servers, backups and CCTV for clients. It earns every day, rain or shine, as long as your machines stay up.</p>
      <ol class="small steps"><li>Buy a machine: a used Lenovo M720q Tiny or Dell OptiPlex Micro is the cheapest start.</li><li>Add memory and a drive (and for towers: a motherboard, CPU and PSU).</li><li>Sign clients in <b>Clients</b>. Add a UPS so load-shedding doesn't knock them offline.</li></ol>
      <button class="btn primary" data-action="nav" data-id="shop" onclick="window.hf.shopTab='pc'">Shop PCs, NAS & servers</button></div>` : '';
    return `<div class="page-head"><div><h1>Servers</h1><div class="muted">${s.servers.length}/${loc.serverSlots} machines · ${s.clients.length} clients · ${m(E.hostingPerDay(s))}/day hosting · ${Math.round(room.serverWatts)} W</div></div>
      <div class="row"><button class="btn" data-action="nav" data-id="shop" onclick="window.hf.shopTab='pc'">+ Buy a machine</button><button class="btn" data-action="nav" data-id="shop" onclick="window.hf.shopTab='ups'">UPS units</button><button class="btn primary" data-action="nav" data-id="clients">Find clients</button></div></div>
      ${empty}${selM ? this.serverBuildHtml(selM) : ''}<div class="grid machines">${cards}</div>`;
  }

  serverBuildHtml(sv) {
    const s = this.state; const m = this.money;
    const st = E.serverStats(s, sv);
    const spec = byId[sv.id]; const board = st.board;
    const row = (o, btn, extra = '') => `<div class="part-row${o.broken ? ' dead' : ''}"><span class="name">${esc(byId[o.id].name)}</span><span class="small muted">${extra}</span>${this.gradeTag(o.q)}<span class="small ${o.broken ? 'bad' : 'muted'}">${o.broken ? 'failed' : `${Math.round((o.cond ?? 1) * 100)}%`}</span>${btn}</div>`;
    const rm = (o) => `<button class="btn small-btn" data-action="srv-remove" data-arg="${sv.uid}" data-uid="${o.uid}">Remove</button>`;
    const info = (o) => { const p = byId[o.id]; return p.kind === 'cpu' ? `${p.cores}C/${p.threads}T` : p.kind === 'ram' ? `${p.gb} GB` : p.kind === 'drive' ? `${E.fmtTb(p.tb)} ${DRIVE_CLASS[p.cls].name}` : p.kind === 'psu' ? `${p.watts} W` : p.kind === 'gpu' ? `${p.vram} GB` : p.kind === 'board' ? p.socket : ''; };
    const section = (title, list, need) => `<div class="part-head">${title}</div>${list.length ? list.map((o) => row(o, rm(o), info(o))).join('') : `<div class="small ${need ? 'bad' : 'muted'}">${need || 'None'}</div>`}`;
    const builtIn = spec.board?.form === 'integrated';
    const spare = s.inventory.filter((o) => SERVER_PARTS.includes(byId[o.id].kind));
    const fits = spare.filter((o) => !o.broken && !E.serverPartProblem(sv, byId[o.id]));
    const noFit = spare.filter((o) => !fits.includes(o)).slice(0, 6);
    const shopBtn = (kind, label) => `<button class="chip" data-action="srv-shop" data-uid="${sv.uid}" data-arg="${kind}">${label}</button>`;
    return `<div class="card build"><div class="spread"><div class="row"><span class="ico-lg">🔧</span><input class="rename" value="${esc(sv.name)}" data-change="srv-rename" data-uid="${sv.uid}" aria-label="Machine name" title="Click to rename"></div>
        <div class="row"><button class="btn primary" data-action="srv-autofill" data-uid="${sv.uid}">⚡ Auto-fill from inventory</button><button class="btn" data-action="srv-3d" data-uid="${sv.uid}">View in 3D</button><button class="btn danger" data-action="sell" data-uid="${sv.uid}">Sell machine</button></div></div>
      <div class="small muted">${esc(spec.name)} · ${builtIn ? `built-in ${esc(spec.board.cpu)} (${spec.board.cores}C/${spec.board.threads}T)` : spec.board ? `${spec.board.cpuSockets}× ${spec.board.socket} board` : `takes ${(spec.forms || []).join('/').toUpperCase()} boards`} · ${[spec.bays35 && `${spec.bays35}× 3.5"`, spec.bays25 && `${spec.bays25}× 2.5"`, board?.m2 && `${board.m2}× M.2`].filter(Boolean).join(' · ')}${spec.psu ? ` · ${spec.psu.watts} W PSU built in` : ''}</div>
      <div class="parts-grid">
        <div><h4>In this machine</h4>
          ${spec.board ? '' : section('Motherboard', sv.board ? [sv.board] : [], 'Needs a motherboard')}
          ${builtIn ? '' : section(`CPU ${sv.cpus.length}/${board?.cpuSockets || 1}`, sv.cpus, board ? 'Needs a CPU' : '')}
          ${section(`Memory ${sv.ram.length}/${board?.ramSlots || '?'} slots${board?.ramBuiltin ? ` (+${board.ramBuiltin} GB built in)` : ''}`, sv.ram, board?.ramBuiltin ? '' : 'Needs memory')}
          ${section(`Drives ${E.fmtTb(st.rawTb)} raw · ${E.fmtTb(st.usableTb)} usable`, sv.drives, 'Needs a drive')}
          ${spec.psu ? '' : section('Power supply', sv.psu ? [sv.psu] : [], 'Needs a PSU')}
          ${spec.gpuSlots ? section(`GPU ${(sv.gpus || []).length}/${spec.gpuSlots}`, sv.gpus || [], '') : ''}
          <div class="row" style="margin-top:10px">
            <label class="row small"><input type="checkbox" data-action="srv-raid" data-uid="${sv.uid}" ${sv.raid ? 'checked' : ''} ${sv.drives.length < 2 ? 'disabled' : ''}> Drive protection (mirror / RAID): survive one dead drive, lose one drive of space</label>
          </div>
          <div class="row small" style="margin-top:6px"><span class="muted">OS</span><select data-change="srv-os" data-uid="${sv.uid}">${Object.entries(SERVER_OS).map(([id, o]) => `<option value="${id}" ${(sv.os || 'linux') === id ? 'selected' : ''}>${o.name}${o.licence && !sv.windowsLicensed ? ` (licence ${m(o.licence)})` : ''}</option>`).join('')}</select></div>
        </div>
        <div><h4>Fits from your inventory</h4>
          ${fits.map((o) => row(o, `<button class="btn primary small-btn" data-action="srv-add" data-arg="${sv.uid}" data-uid="${o.uid}">Add</button>`, info(o))).join('') || '<div class="small muted">Nothing in your inventory fits. Shop for parts that do:</div>'}
          <div class="row" style="margin-top:8px">${spec.board ? '' : shopBtn('board', 'Motherboards')}${builtIn ? '' : shopBtn('cpu', 'CPUs')}${shopBtn('ram', 'Memory')}${shopBtn('drive', 'Drives')}</div>
          ${noFit.length ? `<div class="part-head" style="margin-top:12px">Doesn't fit</div>${noFit.map((o) => `<div class="small muted">✕ ${esc(byId[o.id].name)}: ${esc(o.broken ? 'broken' : E.serverPartProblem(sv, byId[o.id]))}</div>`).join('')}` : ''}
        </div>
      </div></div>`;
  }

  // ---------------------------------------------------------------- clients

  needChips(n) {
    return [`${n.vcpu} threads`, `${n.ramGB} GB RAM`, E.fmtTb(n.tb), n.cls && `${DRIVE_CLASS[n.cls].name} drives`, n.raid && 'protected storage', n.ecc && 'ECC server', n.gpuVram && `GPU ${n.gpuVram} GB+`, n.os && SERVER_OS[n.os].name]
      .filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join(' ');
  }

  viewClients() {
    const s = this.state; const m = this.money;
    const rep = s.reputation || 0;
    const next = CLIENT_TYPES.filter((t) => t.minRep > rep).sort((a, b) => a.minRep - b.minRep)[0];
    const offers = (s.offers || []).map((o) => {
      const t = CLIENT_TYPES.find((x) => x.id === o.typeId);
      const fit = s.servers.find((sv) => !E.fitProblem(s, sv, o.needs));
      const why = !s.servers.length ? 'Build a machine first' : fit ? `Fits ${fit.name}` : `No machine fits: ${E.fitProblem(s, s.servers[0], o.needs)}`;
      return `<div class="card offer"><div class="spread"><span class="name">${t.icon} ${esc(o.client)}</span><span class="small muted">${Math.max(0, Math.ceil(o.expires - s.day))}d left</span></div>
        <div class="small">${esc(t.name)}${o.detail ? ` · ${esc(o.detail)}` : ''}</div>
        <div class="chips">${this.needChips(o.needs)}</div>
        <div class="kv small"><span>Pays</span><span><b class="good">${m(o.payMonthly)}</b> / month</span><span>Contract</span><span>${o.months} months · ${Math.round(o.sla * 100)}% uptime promised</span></div>
        <div class="spread"><span class="small ${fit ? 'good' : 'bad'}">${esc(why)}</span><button class="btn primary" data-action="offer-accept" data-id="${o.id}" ${fit ? '' : 'disabled'}>Sign</button></div></div>`;
    }).join('');
    const rows = s.clients.map((c) => {
      const t = CLIENT_TYPES.find((x) => x.id === c.typeId);
      const sv = s.servers.find((x) => x.uid === c.serverUid);
      const sat = Math.round(c.satisfaction * 100);
      const others = s.servers.filter((x) => x.uid !== c.serverUid && !E.fitProblem(s, x, c.needs));
      return `<tr><td>${t.icon} <b>${esc(c.client)}</b><div class="small muted">${esc(t.name)}${c.detail ? ` · ${esc(c.detail)}` : ''}</div></td>
        <td>${esc(sv?.name || '?')}</td><td class="good">${m(c.payMonthly)}/mo</td>
        <td><div class="bar" title="${sat}%"><i style="width:${sat}%;background:${sat < 50 ? 'var(--bad)' : sat < 70 ? 'var(--warn)' : 'var(--good)'}"></i></div><span class="small muted">${sat}% happy</span></td>
        <td class="small">${Math.max(0, Math.ceil(c.endDay - s.day))} days</td>
        <td><div class="row">${others.length ? `<select data-change="client-move"><option value="">Move to…</option>${others.map((x) => `<option value="${c.id}|${x.uid}">${esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn danger small-btn" data-action="client-end" data-id="${c.id}">End</button></div></td></tr>`;
    }).join('');
    return `<div class="page-head"><div><h1>Clients</h1><div class="muted">Host for local businesses. Keep their machines up and they renew; let them go down and they leave.</div></div></div>
      <div class="grid stats">
        <div class="card"><h3>Reputation</h3><div class="big">${Math.floor(rep)} <span class="small muted">/ 100 · ${E.reputationTier(rep)}</span></div><div class="bar"><i style="width:${rep}%"></i></div>
          <div class="small muted" style="margin-top:6px">${next ? `At ${next.minRep}: ${next.icon} ${esc(next.name)} clients start calling.` : 'Every kind of client knows your name.'}</div></div>
        <div class="card"><h3>Hosting income</h3><div class="big good">${m(E.hostingPerDay(s))}<span class="small muted"> / day</span></div><div class="small muted">${s.clients.length} clients · ${m(s.stats.hostingUsd || 0)} earned so far</div></div>
        <div class="card"><h3>Uptime protection</h3><div class="small">${(s.energy.ups || []).length ? `${s.energy.ups.length} UPS · ${Math.round(s.energy.ups.reduce((t, u) => t + u.charge, 0))} Wh ready` : '<span class="warn">No UPS: load-shedding takes clients offline.</span>'}</div>
          <button class="btn" style="margin-top:8px" data-action="nav" data-id="shop" onclick="window.hf.shopTab='ups'">Shop UPS units</button></div>
      </div>
      <h3 style="margin:16px 0 8px">Looking for hosting (${(s.offers || []).length})</h3><div class="grid">${offers || '<div class="muted">No one right now. New clients call every day.</div>'}</div>
      <h3 style="margin:18px 0 8px">Your clients (${s.clients.length})</h3>
      ${rows ? `<div class="card table-wrap"><table class="clients"><thead><tr><th>Client</th><th>Machine</th><th>Pays</th><th>Satisfaction</th><th>Left</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="muted">No clients yet. Sign one above.</div>'}`;
  }

  // ---------------------------------------------------------------- saves

  slots() {
    try { const v = JSON.parse(localStorage.getItem(SLOTS_KEY) || '[]'); return [0, 1, 2].map((i) => v[i] || null); } catch { return [null, null, null]; }
  }
  writeSlots(slots) {
    try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); return true; } catch { this.toast('Could not save: browser storage is full or blocked.', 'bad'); return false; }
  }
  saveSlot(i) {
    const slots = this.slots();
    this.state.savedAt = Date.now();
    slots[i] = { at: Date.now(), day: this.state.day, cash: this.state.cash, worth: E.netWorth(this.state), loc: E.location(this.state).name, data: E.serialize(this.state) };
    if (this.writeSlots(slots)) { this.toast(`Saved to slot ${i + 1}`, 'good'); this.render(true); }
  }
  loadSlot(i) {
    const slot = this.slots()[i];
    if (!slot) return;
    try { this.useState(E.deserialize(slot.data)); this.toast(`Loaded slot ${i + 1}`, 'good'); } catch { this.toast('That save could not be loaded.', 'bad'); }
  }
  useState(state) {
    this.state = state; this.money = makeMoney(state);
    this.selection = null; this.serverSel = null; this.buildFor = null; this.awayReport = null; this.shownGameOver = false;
    this.closeOverlay?.(); this.save(); this.render(true);
  }
  exportSave() {
    this.save();
    const blob = new Blob([E.serialize(this.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hashforge-day${Math.floor(this.state.day) + 1}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.toast('Save file downloaded', 'good');
  }
  async importSave(file) {
    try { this.useState(E.deserialize(await file.text())); this.toast(`Loaded ${file.name}`, 'good'); } catch { this.toast('That file is not a HashForge save.', 'bad'); }
  }
  savesHtml() {
    const m = this.money;
    const slots = this.slots();
    return `<div class="card saves"><h3>Saves</h3>
      <div class="small muted">The game also saves itself every 10 seconds. Use slots to keep separate games or a backup before a big decision.</div>
      <div class="slots">${slots.map((sl, i) => `<div class="slot"><div><b>Slot ${i + 1}</b>${sl ? `<div class="small muted">Day ${Math.floor(sl.day) + 1} · ${esc(sl.loc)} · ${m(sl.worth ?? sl.cash)} net worth</div><div class="small muted">${new Date(sl.at).toLocaleString()}</div>` : '<div class="small muted">Empty</div>'}</div>
        <div class="row"><button class="btn small-btn primary" data-action="slot-save" data-arg="${i}">${sl ? 'Overwrite' : 'Save here'}</button>${sl ? `<button class="btn small-btn" data-action="slot-load" data-arg="${i}">Load</button><button class="btn small-btn danger" data-action="slot-delete" data-arg="${i}">Delete</button>` : ''}</div></div>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn" data-action="save-now">💾 Save now</button><button class="btn" data-action="export-save">⬇ Download save file</button><button class="btn" data-action="import-save">⬆ Load save file</button>
        <input type="file" id="import-file" accept=".json,application/json" hidden></div></div>`;
  }

  viewSettings() {
    const s = this.state; const reg = E.region(s);
    return `<div class="page-head"><h1>Settings</h1></div>
      <div class="grid">
        <div class="card"><h3>Region & currency</h3>
          <select data-change="region">${REGIONS.map((r) => `<option value="${r.id}" ${r.id === s.region ? 'selected' : ''}>${r.name} (${r.currency})</option>`).join('')}</select>
          <div class="small muted" style="margin-top:6px">Detected from your browser. Changing it resets the tariff to that region's typical price.</div></div>
        <div class="card"><h3>Electricity tariff</h3>
          <div class="row"><span>${reg.symbol}</span><input type="number" step="0.01" min="0.01" value="${s.tariffLocal}" data-change="tariff" style="width:110px"><span>per kWh</span></div>
          <div class="small muted" style="margin-top:6px">Set it to the rate on your own electricity bill: every municipality and plan differs. Exchange rate: 1 USD = ${s.fx.toFixed(2)} ${reg.currency}${this.fxLive ? ' (live)' : ' (offline estimate)'}.</div></div>
        <div class="card"><h3>Game</h3><div class="small muted">Space pauses; keys 1-4 change speed.</div>
          <label class="row small" style="margin-top:8px"><input type="checkbox" data-action="auto-install" ${s.autoInstall !== false ? 'checked' : ''}> Install new parts into a rig or machine automatically</label>
          <button class="btn danger" style="margin-top:8px" data-action="new-game">Start a new game</button></div>
      </div>
      ${this.savesHtml()}
      <p class="disclaimer" style="margin-top:16px">HashForge is a game. Hardware names identify real products and belong to their owners; HashForge is not affiliated with any manufacturer. Hash rates, prices and tariffs are approximations, and coin prices are simulated. Nothing here is financial advice.</p>`;
  }

  renderSide() {
    const s = this.state;
    const tips = E.advise(s).slice(0, 4);
    const reg = E.region(s);
    const goal = E.currentGoal(s, this.room);
    const sideHtml = `
      <div class="goal-card"><div class="spread"><h3>🎯 ${goal.endless ? 'Milestone' : `Goal ${goal.index + 1} of ${goal.total}`}</h3><span class="reward">+${this.money(goal.reward)}</span></div>
        <div class="goal-title">${esc(this.fmt(goal.title))}</div>
        <div class="bar glow" style="margin:8px 0 6px"><i style="width:${Math.round(goal.value * 100)}%"></i></div>
        <div class="small muted">${esc(this.fmt(goal.hint))}</div></div>
      ${this.contractsHtml()}
      <section><h3 class="side-h">🤖 Advisor</h3>${tips.map((t) => `<div class="tip ${t.level}">${esc(this.fmt(t.text))}</div>`).join('')}</section>
      ${reg.loadShedding ? `<section><h3 class="side-h">Load-shedding ${s.grid.stage ? `<span class="pill warn">Stage ${s.grid.stage}</span>` : '<span class="pill good">off</span>'}</h3>
        <div class="shed">${E.sheddingSchedule(s, 24).map((off, i) => `<i class="${off ? 'off' : ''} ${i === 0 ? 'now' : ''}"></i>`).join('')}</div>
        <div class="small muted" style="margin-top:4px">Next 24 hours (red = no grid)</div></section>` : ''}
      <section><h3 class="side-h">Log</h3><div class="log">${s.log.slice(0, 12).map((l) => `<div class="${l.type}"><span class="muted">D${Math.floor(l.day) + 1}</span> ${esc(this.fmt(l.text))}${l.count > 1 ? ` <span class="count">×${l.count}</span>` : ''}</div>`).join('')}</div></section>`;
    if (sideHtml !== this.lastSideHtml) { this.lastSideHtml = sideHtml; $('#side').innerHTML = sideHtml; }
    if (s.gameOver && !this.shownGameOver) {
      this.shownGameOver = true;
      this.toast('Bankrupt! Start a new game from Settings, or Hard Fork if you qualified.', 'bad');
    }
  }

  // ---------------------------------------------------------------- career

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Toasts, sounds, confetti and banners for whatever the career tick reported. */
  celebrate(out) {
    if (!out) return;
    const m = this.money;
    (out.achievements || []).slice(0, 3).forEach((a, i) => setTimeout(() => {
      this.toast(`${a.icon} Badge unlocked: ${a.name}${a.reward ? ` (+${m(a.reward)})` : ''}`, 'gold');
      sfx.badge();
      confetti({ x: 0.5, y: 0.2, count: 70, spread: 0.8 });
    }, i * 700));
    if ((out.achievements || []).length > 3) this.toast(`…and ${out.achievements.length - 3} more badges. See Career.`, 'gold');
    (out.levelUps || []).slice(-1).forEach((u) => {
      banner(`LEVEL ${u.level}`, u.rank ? `New rank: ${u.rank}` : `Level bonus +${m(u.reward)}`);
      sfx.level();
      confetti({ count: 200, spread: 1.2 });
    });
    (out.jobs || []).forEach((j) => { this.toast(`📋 Contract complete: ${j.title}. Claim it!`, 'good'); sfx.alert(); });
    if (out.event) { sfx.alert(); }
  }

  contractsHtml() {
    const c = C.ensure(this.state); const m = this.money; const s = this.state;
    const day = Math.floor(s.day);
    const jobs = [...c.jobs].sort((a, b) => b.done - a.done);
    return `<section class="contracts"><div class="spread"><h3 class="side-h">📋 Contracts</h3><span class="small muted">${c.jobsDone} done</span></div>
      ${jobs.map((j) => {
        const p = j.done ? 1 : C.jobProgress(s, j, this.room);
        const left = j.endsDay - day;
        return `<div class="job ${j.done ? 'done' : ''}">
          <div class="spread"><span class="job-title">${esc(this.fmt(j.title))}</span>
            ${j.done ? `<button class="btn claim" data-action="claim-job" data-id="${j.id}">Claim</button>` : `<button class="icon-btn x" data-action="drop-job" data-id="${j.id}" title="Skip this contract" aria-label="Skip">✕</button>`}</div>
          <div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div>
          <div class="job-meta"><span class="good">+${m(j.reward)}</span><span class="xp">+${j.xp} XP</span>${j.done ? '<span class="good">Ready</span>' : `<span class="${left <= 1 ? 'warn' : 'muted'}">${left <= 0 ? 'last day' : `${left}d left`}</span>`}</div>
        </div>`;
      }).join('') || '<div class="small muted">New contracts arrive soon.</div>'}</section>`;
  }

  renderEvent() {
    const v = C.eventView(this.state);
    let el = document.getElementById('event');
    if (!el) { el = document.createElement('div'); el.id = 'event'; document.body.appendChild(el); }
    const html = v && !this.startOpen ? `<div class="event-card">
        <div class="event-tag">Event</div>
        <div class="event-head"><span class="event-ico">${v.icon}</span><h3>${esc(this.fmt(v.title))}</h3></div>
        <p>${esc(this.fmt(v.text))}</p>
        <div class="event-choices">${v.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-action="event-choice" data-arg="${c.i}" ${c.affordable ? '' : 'disabled title="Not enough cash"'}>${esc(this.fmt(c.label))}</button>`).join('')}</div>
      </div>` : '';
    if (html !== this.lastEventHtml) { this.lastEventHtml = html; el.innerHTML = html; }
  }

  /** Title screen: welcome back, what happened while away, and the daily bonus. */
  showStart() {
    const s = this.state; const c = C.ensure(s); const m = this.money;
    const fresh = !s.rigs.length && !s.racks.length && !(s.servers || []).length && s.day < 1;
    const daily = C.dailyAvailable(s, this.today()) ? C.dailyPreview(s, this.today()) : null;
    const away = this.awayReport;
    this.speedBefore = this.speedIndex || 1;
    this.speedIndex = 0;
    this.startOpen = true;
    const el = document.createElement('div');
    el.id = 'start';
    el.innerHTML = `<div class="start-card">
      <div class="start-logo"><span class="logo">⬢</span> HashForge</div>
      <div class="start-sub">${fresh ? 'Build a crypto-mining and hosting empire from a bedroom corner.' : `Level ${c.level} · ${esc(C.rankOf(c.level))} · Day ${Math.floor(s.day) + 1}`}</div>
      ${fresh ? `<ul class="start-list"><li>⛏️ Build GPU rigs and racks of ASIC miners</li><li>🖥️ Build servers and host paying clients</li><li>⚡ Survive load-shedding with UPS, solar and batteries</li><li>🏆 Level up, finish contracts and collect badges</li></ul>` : `
      <div class="start-stats"><div><span>Cash</span><b>${m(s.cash)}</b></div><div><span>Net worth</span><b>${m(E.netWorth(s))}</b></div><div><span>Badges</span><b>${Object.keys(c.achievements).length} / ${C.ACHIEVEMENTS.length}</b></div></div>`}
      ${away ? `<div class="start-away">While you were away (${away.days.toFixed(1)} game days): mined <b class="good">${m(away.mined)}</b>, cash <b class="${away.cashChange >= 0 ? 'good' : 'bad'}">${away.cashChange >= 0 ? '+' : ''}${m(away.cashChange)}</b></div>` : ''}
      ${daily ? `<div class="daily">
        <div class="spread"><b>🔥 Daily bonus</b><span class="muted small">Day ${daily.count} streak</span></div>
        <div class="flames">${Array.from({ length: 7 }, (_, i) => `<i class="${i < Math.min(daily.count, 7) ? 'lit' : ''}">${i + 1}</i>`).join('')}</div>
        <div class="small muted">Come back every day: the bonus grows for 14 days.</div>
        <button class="btn primary big" data-action="daily-claim">Claim ${m(daily.cash)} + ${daily.xp} XP</button></div>` : ''}
      <button class="btn ${daily ? '' : 'primary'} big" data-action="start-play">${fresh ? 'Start mining' : daily ? 'Skip for now' : 'Continue'}</button>
      <div class="start-keys muted small">Space pauses · keys 1 to 4 set the speed</div>
    </div>`;
    document.body.appendChild(el);
  }

  closeStart() {
    document.getElementById('start')?.remove();
    if (!this.startOpen) return;
    this.startOpen = false;
    this.awayReport = null;
    this.speedIndex = this.speedBefore || 1;
    this.render(true);
  }

  viewCareer() {
    const s = this.state; const c = C.ensure(s); const m = this.money;
    const need = C.xpToNext(c.level);
    const next = C.nextRank(c.level);
    const got = Object.keys(c.achievements).length;
    const daily = C.dailyAvailable(s, this.today()) ? C.dailyPreview(s, this.today()) : null;
    const buffs = (s.buffs || []).filter((b) => b.untilDay > s.day);
    const st = s.stats;
    return `
      <div class="page-head"><div><h1>Career</h1><div class="muted">Level up from earnings, contracts, events and badges. Every level pays a bonus.</div></div></div>
      <div class="career-top">
        <div class="card career-hero">
          <div class="big-ring" style="--p:${(c.xp / need * 100).toFixed(1)}"><div><b>${c.level}</b><span>level</span></div></div>
          <div class="hero-text">
            <div class="rank-big">${esc(C.rankOf(c.level))}</div>
            <div class="muted">${Math.round(c.xp).toLocaleString()} / ${need.toLocaleString()} XP to level ${c.level + 1} (bonus ${m(C.levelReward(c.level + 1))})</div>
            <div class="bar glow" style="margin:10px 0"><i style="width:${(c.xp / need * 100).toFixed(1)}%"></i></div>
            <div class="small muted">${next ? `Next rank: <b>${esc(next[1])}</b> at level ${next[0]}` : 'Top rank reached. Legend.'} · Contract slots: ${C.jobSlots(c.level)}</div>
            <div class="rank-ladder">${C.RANKS.map(([l, n]) => `<span class="${c.level >= l ? 'on' : ''}" title="Level ${l}">${esc(n)}</span>`).join('')}</div>
          </div>
        </div>
        <div class="card streak-card">
          <h3>🔥 Daily streak</h3>
          <div class="flames">${Array.from({ length: 7 }, (_, i) => `<i class="${i < Math.min(c.streak.count, 7) ? 'lit' : ''}">${i + 1}</i>`).join('')}</div>
          <div class="small muted">Current ${c.streak.count} · best ${c.streak.best || 0}</div>
          ${daily ? `<button class="btn primary" style="margin-top:10px;width:100%" data-action="daily-claim">Claim ${m(daily.cash)} + ${daily.xp} XP</button>` : '<div class="small good" style="margin-top:10px">Claimed today. Back tomorrow!</div>'}
          ${buffs.length ? `<h3 style="margin-top:14px">Active boosts</h3>${buffs.map((b) => `<div class="buff-row"><span>${esc(b.label)}</span><span class="muted">${Math.ceil(b.untilDay - s.day)} days</span></div>`).join('')}` : ''}
        </div>
      </div>
      <div class="card career-jobs" style="margin-top:14px">${this.contractsHtml()}</div>
      <div class="spread" style="margin:20px 0 10px"><h2>Badges</h2><span class="muted">${got} / ${C.ACHIEVEMENTS.length} unlocked</span></div>
      <div class="badges">${C.ACHIEVEMENTS.map((a) => {
        const on = c.achievements[a.id] !== undefined;
        return `<div class="badge ${on ? 'on' : ''}"><div class="badge-ico">${a.icon}</div><div><div class="badge-name">${esc(a.name)}</div><div class="small muted">${esc(this.fmt(a.desc))}</div>
          <div class="small ${on ? 'good' : 'muted'}">${on ? `Unlocked day ${Math.floor(c.achievements[a.id]) + 1}` : a.reward ? `Reward ${m(a.reward)}` : ''}</div></div></div>`;
      }).join('')}</div>
      <h2 style="margin:20px 0 10px">Lifetime</h2>
      <div class="grid">
        <div class="card stat-card"><span>Mined</span><b>${m(st.minedUsd)}</b></div>
        <div class="card stat-card"><span>Hosting income</span><b>${m(st.hostingUsd || 0)}</b></div>
        <div class="card stat-card"><span>Power bills paid</span><b>${m(st.powerPaid)}</b></div>
        <div class="card stat-card"><span>Best day</span><b>${m(st.bestDay)}</b></div>
        <div class="card stat-card"><span>Contracts done</span><b>${c.jobsDone}</b></div>
        <div class="card stat-card"><span>Events handled</span><b>${c.eventsDone}</b></div>
        <div class="card stat-card"><span>Cards built</span><b>${st.crafted}</b></div>
        <div class="card stat-card"><span>Hours mining</span><b>${(st.onlineHours || 0).toLocaleString()}</b></div>
      </div>`;
  }

  openOverlay(title) {
    $('#overlay').hidden = false;
    $('#overlay-title').textContent = title;
    this.speedBeforeOverlay = this.speedBeforeOverlay ?? this.speedIndex;
  }

  closeOverlay() {
    $('#overlay').hidden = true;
    this.overlayMode = null;
    if (this.tour) { this.tour.renderer.setAnimationLoop(null); this.tour.renderer.domElement.remove(); this.tour = null; }
    if (this.viewer) this.viewer.renderer.domElement.style.display = '';
    this.render(true);
  }

  async openViewer(spec, owned = {}, { assemble = false } = {}) {
    this.openOverlay(spec.name);
    this.overlayMode = { type: 'viewer', spec, owned };
    const v = await this.ensureViewer();
    v.renderer.domElement.style.display = '';
    v.show(spec, owned);
    if (assemble && v.canExplode) { v.explodeNow = 1; v.setExploded(false); }
    const s = this.state; const m = this.money;
    $('#overlay-panel').innerHTML = `
      <div class="spread"><h3>${esc(spec.name)}</h3>${owned.q ? this.gradeTag(owned.q) : ''}</div>
      ${spec.year ? `<div class="muted small">Released ${spec.year}${spec.maker ? ` · ${esc(spec.maker)}` : ''}${spec.gen ? ` · ${spec.gen}` : ''}</div>` : ''}
      ${this.specLines(spec, owned.q || 'new')}
      ${owned.uid ? `<div class="small">Condition ${Math.round((owned.cond ?? 1) * 100)}%${owned.broken ? ' · <span class="bad">FAILED</span>' : ''}</div>` : `<div class="price" style="font-size:20px;font-weight:800">${m(E.buyPrice(s, spec))} new</div>`}
      ${!owned.uid && spec.kind !== 'part' ? `<button class="btn primary" data-action="buy" data-id="${spec.id}">Buy new</button>` : ''}
      <p class="disclaimer">Original 3D artwork, not a replica of any product design. Drag to rotate, scroll to zoom.</p>`;
    $('#stage3d').querySelector('.stage-ctrl')?.remove();
    if (v.canExplode) {
      const ctrl = document.createElement('div');
      ctrl.className = 'stage-ctrl';
      ctrl.innerHTML = '<button class="btn" data-action="explode">💥 Exploded view</button>';
      $('#stage3d').appendChild(ctrl);
    }
  }

  async openRig(uid) {
    const rig = this.state.rigs.find((r) => r.uid === uid);
    if (!rig) return;
    this.openOverlay(`${rig.name}: workshop`);
    this.overlayMode = { type: 'rig', uid };
    await this.ensureViewer();
    await this.refreshOverlay(true);
  }

  async refreshOverlay(rebuild = false) {
    if (!this.overlayMode) return;
    if (this.overlayMode.type !== 'rig') { if (this.overlayMode.type === 'viewer') this.openViewer(this.overlayMode.spec, this.overlayMode.owned); return; }
    const s = this.state; const m = this.money;
    const rig = s.rigs.find((r) => r.uid === this.overlayMode.uid);
    if (!rig) { this.closeOverlay(); return; }
    const v = await this.ensureViewer();
    const { makeRig } = await import('../render/models.js');
    const key = JSON.stringify([rig.gpus.map((g) => g.uid + g.broken), rig.psus.map((p) => p.uid), (rig.risers || []).map((r) => r.uid + r.broken), rig.boot?.uid]);
    if (rebuild || key !== this.rigKey) {
      this.rigKey = key;
      const model = makeRig(byId[rig.frameId], rig.gpus.map((g) => ({ spec: byId[g.id], q: g.q, broken: g.broken })), rig.psus.map((p) => ({ spec: byId[p.id], q: p.q })), {
        detail: 'full',
        risers: (rig.risers || []).map((r) => ({ spec: byId[r.id], broken: r.broken })),
        boot: rig.boot ? { spec: byId[rig.boot.id] } : null,
      });
      v.renderer.domElement.style.display = '';
      v.replaceModel(model);
      $('#stage3d').querySelector('.stage-ctrl')?.remove();
    }
    const st = E.rigStats(s, rig);
    const frame = byId[rig.frameId];
    const spareGpus = s.inventory.filter((o) => byId[o.id].kind === 'gpu');
    const sparePsus = s.inventory.filter((o) => byId[o.id].kind === 'psu');
    const line = (o, extra = '') => `<div class="card" style="padding:8px"><div class="spread"><span>${esc(byId[o.id].name)}</span>${this.gradeTag(o.q)}</div>
      <div class="small muted">Condition ${Math.round((o.cond ?? 1) * 100)}%${o.broken ? ' · <span class="bad">FAILED</span>' : ''}</div><div class="row" style="margin-top:6px">${extra}</div></div>`;
    $('#overlay-panel').innerHTML = `
      <div class="kv"><span>Status</span><span class="${st.running ? 'good' : 'bad'}">${st.status.replace('-', ' ')}</span>
        <span>PSU load</span><span class="${st.psuLoadPct > 1 ? 'bad' : st.psuLoadPct > 0.85 ? 'warn' : ''}">${Math.round(st.dcLoad)} / ${st.psuCapacity} W</span>
        <span>Hashrate</span><span>${hashrate(st.potentialHashrate, st.unit)} ${ALGOS[st.algo].name}</span><span>Earns</span><span>${m(st.grossPerDay)}/day</span></div>
      <div class="row"><button class="btn primary" data-action="autofill" data-uid="${rig.uid}">⚡ Auto-fill from inventory</button><button class="btn" data-action="toggle" data-uid="${rig.uid}">${rig.on ? 'Switch off' : 'Switch on'}</button></div>
      <h3>Boot drive & OS</h3>
      ${rig.boot ? line(rig.boot) : '<div class="tip critical">No boot drive: this rig cannot load an OS.</div>'}
      ${s.inventory.filter((o) => byId[o.id].kind === 'boot' && !o.broken).map((o) => line(o, `<button class="btn primary" data-action="install-boot" data-arg="${rig.uid}" data-uid="${o.uid}">${rig.boot ? 'Swap in' : 'Install'}</button>`)).join('')}
      ${!rig.boot && !s.inventory.some((o) => byId[o.id].kind === 'boot') ? '<div class="muted small">Buy a USB flash drive or SSD under Vendors → Risers, boot & thermal.</div>' : ''}
      <select data-change="os" data-uid="${rig.uid}">${Object.entries(OS).map(([id, o]) => `<option value="${id}" ${(rig.os || 'linux') === id ? 'selected' : ''}>${o.name}${o.licence && !rig.windowsLicensed ? ` (licence ${m(o.licence)})` : ''}</option>`).join('')}</select>
      <div class="small muted">${OS[rig.os || 'linux'].desc}</div>
      <h3>Power supplies (${rig.psus.length}/${frame.psuSlots})</h3>
      ${rig.psus.map((p) => line(p, `${this.repairBtn(p)}<button class="btn" data-action="uninstall" data-arg="${rig.uid}" data-uid="${p.uid}">Remove</button>`)).join('')}
      ${rig.psus.length < frame.psuSlots ? sparePsus.map((p) => line(p, `<button class="btn primary" data-action="install" data-arg="${rig.uid}" data-uid="${p.uid}">Install</button>`)).join('') || '<div class="muted small">No spare PSUs. Buy one from Vendors or the Used market.</div>' : ''}
      <h3>GPUs (${rig.gpus.length}/${frame.slots})</h3>
      ${rig.gpus.map((g, i) => line(g, `${this.modTags(g)}${this.modButtons(g)}${this.repairBtn(g)}<button class="btn" data-action="uninstall" data-arg="${rig.uid}" data-uid="${g.uid}">Remove</button>${rig.risers?.[i]?.broken ? '<span class="bad small">riser dead</span>' : ''}`)).join('')}
      ${rig.gpus.length < frame.slots ? spareGpus.map((g) => line(g, `<button class="btn primary" data-action="install" data-arg="${rig.uid}" data-uid="${g.uid}">Install</button>`)).join('') || '<div class="muted small">No spare GPUs in inventory.</div>' : ''}
      <h3>PCIe risers</h3>
      ${(rig.risers || []).map((r, i) => {
        const spare = s.inventory.filter((o) => byId[o.id].kind === 'riser');
        return `<div class="card" style="padding:8px"><div class="spread"><span class="small">Slot ${i + 1}: ${esc(byId[r.id].name)}</span>${r.broken ? '<span class="bad small">DEAD</span>' : byId[r.id].fireRisk ? '<span class="warn small">⚠ SATA</span>' : '<span class="good small">OK</span>'}</div>
          ${spare.length ? `<div class="row" style="margin-top:6px">${spare.slice(0, 3).map((o) => `<button class="btn" data-action="swap-riser" data-arg="${rig.uid}:${i}" data-uid="${o.uid}">Swap: ${esc(byId[o.id].name.replace('PCIe Riser ', ''))}</button>`).join('')}</div>` : ''}</div>`;
      }).join('')}
      ${!rig.gpus.length && !rig.psus.length ? `<button class="btn danger" data-action="sell" data-uid="${rig.uid}">Sell rig kit</button>` : ''}`;
  }

  async openTour() {
    this.openOverlay('3D Tour');
    this.overlayMode = { type: 'tour' };
    if (this.viewer) this.viewer.renderer.domElement.style.display = 'none';
    $('#stage3d').querySelector('.stage-ctrl')?.remove();
    const { MiningRoom } = await import('../render/scene.js');
    this.tour = new MiningRoom($('#stage3d'), { onSelect: (pick) => {
      if (pick.type === 'rig') { this.closeOverlay(); this.openRig(pick.uid); }
      if (pick.type === 'server') { this.closeOverlay(); this.view = 'servers'; this.serverSel = pick.uid; this.render(true); }
    } });
    $('#overlay-panel').innerHTML = `<h3>Your operation in 3D</h3><div class="muted small">Drag to orbit, scroll to zoom. Fans spin with load, LEDs blink, and the lights die during outages. Click a rig to open its workshop.</div>${this.summaryCards()}`;
  }

  showLot(lot, found) {
    this.openOverlay(`Opened: ${lot.name}`);
    this.overlayMode = { type: 'lot' };
    if (this.viewer) this.viewer.renderer.domElement.style.display = 'none';
    $('#stage3d').querySelector('.stage-ctrl')?.remove();
    const goldens = found.filter((f) => f.q === 'golden').length;
    const sorted = [...found].sort((a, b) => QUALITY[b.q].rank - QUALITY[a.q].rank);
    $('#overlay-panel').innerHTML = `<h3>${found.length} items${goldens ? ` · <span style="color:var(--gold)">${goldens} golden!</span>` : ''}</h3>
      <div class="reveal">${sorted.map((f, i) => `<div class="card" style="animation-delay:${i * 60}ms"><div class="small">${esc(f.kind === 'part' ? E.partLabel(f) : byId[f.id].name)}</div>
        <div>${this.gradeTag(f.q)} ${f.broken ? '<span class="bad small">dead</span>' : ''}</div><div class="small muted">${f.kind === 'part' ? 'Part' : f.kind === 'card' ? 'Whole card' : 'PSU'}</div></div>`).join('')}</div>
      <div class="row"><button class="btn primary" data-action="nav" data-id="bench">Go to Workbench</button><button class="btn" data-action="close-overlay">Close</button></div>`;
    const best = sorted[0];
    if (best) {
      this.ensureViewer().then((v) => {
        v.renderer.domElement.style.display = '';
        v.show(byId[best.kind === 'part' ? best.model : best.id], { q: best.q, broken: best.broken });
        if (v.canExplode && best.kind === 'part') { v.setExploded(true); v.explodeNow = 1; }
      });
    }
  }
}
