// HashForge UI: game loop, screens, 3D overlays and saving.

import {
  ALGOS, GPU_ALGOS, GPUS, ASICS, PSUS, FRAMES, COOLING, RACKS, INVERTERS, BATTERIES, SOLAR, GENERATORS,
  LOCATIONS, REGIONS, byId,
} from '../data/catalog.js';
import { QUALITY, JUNK_LOTS, UPGRADES, upgradeCost, forkThreshold, forkReward, CRAFT_FEE, PART_TYPES } from '../data/progression.js';
import * as E from '../sim/engine.js';
import { FloorPlan } from './floor2d.js';
import { detectRegion, fetchFx, makeMoney, num, hashrate, kw, gameDate, esc } from './format.js';

const SAVE_KEY = 'hashforge-save-v2';
const SPEEDS = [0, 1, 6, 24, 96];          // game hours per real second
const $ = (sel) => document.querySelector(sel);

const NAV = [
  ['floor', '🏭', 'Floor'], ['shop', '🛒', 'Vendors'], ['used', '♻️', 'Used'], ['junk', '🗑️', 'Junkyard'],
  ['bench', '🛠️', 'Workbench'], ['inventory', '📦', 'Inventory'], ['power', '⚡', 'Power'], ['market', '📈', 'Market'],
  ['fork', '🔱', 'Hard Fork'], ['settings', '⚙️', 'Settings'],
];
const SHOP_TABS = [
  ['gpu', 'GPUs', GPUS], ['asic', 'ASIC miners', ASICS], ['frame', 'Rig kits', FRAMES], ['psu', 'Power supplies', PSUS],
  ['rack', 'Racks', RACKS], ['cooling', 'Cooling & AC', COOLING], ['energy', 'Solar & backup', [...INVERTERS, ...BATTERIES, ...SOLAR, ...GENERATORS]],
  ['location', 'Locations', []],
];

export class App {
  constructor() {
    this.view = 'floor';
    this.shopTab = 'gpu';
    this.speedIndex = 1;
    this.selection = null;
    this.bench = {};
    this.lastRender = 0;
    this.load();
    this.money = makeMoney(this.state);
    this.renderNav();
    this.bindEvents();
    this.render();
    this.updateFx();
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    setInterval(() => this.save(), 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  // ---------------------------------------------------------------- persistence

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { this.state = E.deserialize(raw); return; }
    } catch { /* corrupt or old save: start fresh */ }
    const region = detectRegion();
    this.state = E.newGame(undefined, { region });
  }

  save() {
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
    if (this.floor && this.view === 'floor') this.floor.draw(this.state, this.room, now / 1000);
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
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 4200);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }

  result(res, okText) {
    if (!res.ok) { this.toast(res.error, 'bad'); return false; }
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
      this.act(action, { id, uid, arg, el });
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      this.act(el.dataset.change, { value: el.value, uid: el.dataset.uid, el });
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); this.speedIndex = this.speedIndex ? 0 : 1; this.render(true); }
      if (e.key === 'Escape') this.closeOverlay();
      if (/^[1-4]$/.test(e.key)) { this.speedIndex = +e.key; this.render(true); }
    });
  }

  act(action, a) {
    const s = this.state;
    const m = this.money;
    switch (action) {
      case 'nav': this.view = a.id; this.selection = null; this.render(true); break;
      case 'speed': this.speedIndex = +a.arg; this.render(true); break;
      case 'shop-tab': this.shopTab = a.id; this.render(true); break;
      case 'buy': {
        const item = byId[a.id];
        if (this.result(E.buy(s, a.id), `Bought ${item.name}`) && item.kind === 'frame') this.toast('Add a PSU and GPUs: open the rig from the Floor.', '');
        break;
      }
      case 'inspect': this.openViewer(byId[a.id], a.uid ? this.findOwned(a.uid) : {}); break;
      case 'buy-listing': this.result(E.buyListing(s, a.id), 'Bought second-hand'); break;
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
      case 'autofill': if (this.result(E.autoFill(s, a.uid), 'Rig filled from inventory')) this.refreshOverlay(); break;
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
        if (!confirm('Hard Fork? Your hardware, cash and location reset. You keep Fork Shards and upgrades.')) return;
        const res = E.hardFork(s);
        if (res.ok) { this.state = res.state; this.money = makeMoney(this.state); this.toast(`Hard Fork complete: +${res.reward} Fork Shards`, 'gold'); this.save(); this.render(true); }
        else this.toast(res.error, 'bad');
        break;
      }
      case 'new-game':
        if (!confirm('Start a brand new game? This deletes your save, including prestige.')) return;
        this.state = E.newGame(undefined, { region: this.state.region, tariffLocal: this.state.tariffLocal, fx: this.state.fx });
        this.money = makeMoney(this.state); this.save(); this.render(true);
        break;
      case 'tour': this.openTour(); break;
      case 'explode': this.viewer?.setExploded(a.el.classList.toggle('on')); break;
      case 'close-overlay': this.closeOverlay(); break;
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
    this.renderHud();
    this.renderMain(force);
    this.renderSide();
  }

  renderNav() {
    $('#nav').innerHTML = NAV.map(([id, ico, label]) =>
      `<button class="nav-btn" data-action="nav" data-id="${id}"><span class="ico">${ico}</span>${label}</button>`).join('');
  }

  renderHud() {
    const s = this.state; const r = this.room || E.roomStats(s); const m = this.money;
    const profit = r.grossPerDay - r.demandWatts / 1000 * 24 * r.tariff * (r.offline ? 0 : 1);
    const reg = E.region(s);
    const shedding = reg.loadShedding && s.grid.stage > 0;
    $('#hud').innerHTML = `
      <div class="brand"><span>HashForge</span></div>
      <div class="stat"><span class="muted">Cash</span><b class="${s.cash < 0 ? 'bad' : ''}">${m(s.cash)}</b></div>
      <div class="stat"><span class="muted">Profit / day</span><b class="${profit >= 0 ? 'good' : 'bad'}">${m(profit)}</b></div>
      <div class="stat"><span class="muted">Power</span><b>${kw(r.demandWatts)}</b></div>
      <div class="stat"><span class="muted">Tariff</span><b>${m(s.tariffLocal / s.fx * r.location.tariffMult * E.effects(s).tariff, { precise: true })}/kWh</b></div>
      <div class="stat"><span class="muted">Chips</span><b class="${r.deviceTemp > 85 ? 'bad' : r.deviceTemp > 75 ? 'warn' : ''}">${r.minerWatts ? Math.round(r.deviceTemp) : Math.round(r.roomTemp)} °C</b></div>
      <div class="stat"><span class="muted">Grid</span><b class="${r.offline ? 'bad' : shedding ? 'warn' : 'good'}">${r.offline ? 'DOWN' : shedding ? `Stage ${s.grid.stage}` : 'OK'}</b></div>
      <div class="stat"><span class="muted">${gameDate(s.day)}</span><b>Day ${Math.floor(s.day) + 1}</b></div>
      ${s.prestige.forks ? `<div class="stat"><span class="muted">Era</span><b class="warn">Fork ${s.prestige.forks}</b></div>` : ''}
      <div class="speed">${SPEEDS.map((sp, i) => `<button class="${i === this.speedIndex ? 'on' : ''}" data-action="speed" data-arg="${i}" title="${sp ? `${sp} game hours per second` : 'Pause'}">${sp ? `${sp}×` : '❚❚'}</button>`).join('')}</div>`;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('on', b.dataset.id === this.view));
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
      market: () => this.viewMarket(), fork: () => this.viewFork(), settings: () => this.viewSettings(),
    }[this.view]();
    if (!force && html === this.lastMainHtml) return;   // nothing changed: keep the DOM (and any click in progress)
    this.lastMainHtml = html;
    const scroll = $('#main').scrollTop;
    $('#main').innerHTML = html;
    $('#main').scrollTop = scroll;
    if (this.view === 'floor') {
      this.floor = new FloorPlan($('#floor'), { onSelect: (pick) => this.onFloorSelect(pick) });
      this.floor.selected = this.selection?.uid;
      this.renderFloorDetails();
    } else this.floor = null;
    if (this.view === 'market') this.drawCharts();
  }

  onFloorSelect(pick) {
    if (pick.type === 'shop') { this.view = 'shop'; this.shopTab = pick.tab; this.render(true); return; }
    if (pick.type === 'power') { this.view = 'power'; this.render(true); return; }
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
        <button class="btn" data-action="toggle" data-uid="${rig.uid}">${rig.on ? 'Switch off' : 'Switch on'}</button></div></div>
        <div class="kv" style="margin-top:8px">
          <span>Status</span><span class="${st.running ? 'good' : 'bad'}">${st.status.replace('-', ' ')}</span>
          <span>Hashrate</span><span>${hashrate(st.potentialHashrate, st.unit)} on ${ALGOS[st.algo].name}</span>
          <span>PSU load</span><span class="${st.psuLoadPct > 1 ? 'bad' : st.psuLoadPct > 0.85 ? 'warn' : ''}">${Math.round(st.dcLoad)} W / ${st.psuCapacity} W (${Math.round(st.psuLoadPct * 100)}%)</span>
          <span>Wall power</span><span>${kw(st.dcLoad / st.efficiency)} at ${Math.round(st.efficiency * 100)}% efficiency</span>
          <span>Earning</span><span>${m(st.grossPerDay)} / day before power</span>
          <span>Algorithm</span><span><select data-change="algo" data-uid="${rig.uid}">${['auto', ...GPU_ALGOS].map((a) => `<option value="${a}" ${rig.algo === a ? 'selected' : ''}>${a === 'auto' ? 'Auto (most profitable)' : `${ALGOS[a].name} (${ALGOS[a].coin})`}</option>`).join('')}</select></span>
        </div></div>`;
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
      <div class="card"><h3>Today</h3><div class="kv"><span>Mining</span><span class="good">${m(r.grossPerDay)}/day</span><span>Power</span><span class="bad">${m(r.demandWatts / 1000 * 24 * r.tariff)}/day</span><span>Net worth</span><span>${m(E.netWorth(this.state))}</span></div></div>
      <div class="card"><h3>Room</h3><div class="kv"><span>Room temp</span><span>${r.roomTemp.toFixed(1)} °C</span><span>Cooling</span><span>${kw(r.coolingCapacity)} of ${kw(r.minerWatts)} heat</span><span>Circuit</span><span class="${r.circuitPct > 0.9 ? 'bad' : ''}">${Math.round(r.circuitPct * 100)}%</span><span>Throttle</span><span class="${r.throttle < 1 ? 'warn' : ''}">${Math.round(r.throttle * 100)}%</span></div></div>
    </div>`;
  }

  gradeTag(q) {
    return `<span class="grade" style="color:${QUALITY[q || 'new'].color}">${QUALITY[q || 'new'].name}</span>`;
  }

  repairBtn(o) {
    if (!o.broken && (o.cond ?? 1) >= 0.99) return '';
    return `<button class="btn" data-action="repair" data-uid="${o.uid}">${o.broken ? 'Repair' : 'Service'} ${this.money(E.repairCost(this.state, o))}</button>`;
  }

  ownedCard(o, actions = '') {
    const spec = byId[o.id];
    return `<div class="card product"><div class="spread"><span class="name">${esc(spec.name)}</span>${this.gradeTag(o.q)}</div>
      <div class="small muted">Condition ${Math.round((o.cond ?? 1) * 100)}%${o.broken ? ' · <span class="bad">FAILED</span>' : ''}${o.crafted ? ' · hand-built' : ''}</div>
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
    }[item.kind];
    return lines ? `<div class="kv">${lines().map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>` : '';
  }

  viewShop() {
    const s = this.state; const m = this.money;
    const tabs = `<div class="tabs">${SHOP_TABS.map(([id, label]) => `<button class="${id === this.shopTab ? 'on' : ''}" data-action="shop-tab" data-id="${id}">${label}</button>`).join('')}</div>`;
    if (this.shopTab === 'location') {
      const cur = LOCATIONS.indexOf(E.location(s));
      return `<div class="page-head"><h1>Vendors</h1>${tabs}</div><div class="grid">${LOCATIONS.map((l, i) => `
        <div class="card product"><span class="name">${esc(l.name)}</span>
        <div class="kv"><span>Rigs / racks</span><span>${l.rigSlots} / ${l.rackSlots}</span><span>Circuit</span><span>${l.circuitKw} kW</span><span>Power price</span><span>${l.tariffMult === 1 ? 'Home tariff' : `${Math.round((1 - l.tariffMult) * 100)}% cheaper`}</span><span>Roof for solar</span><span>${l.roofKwp} kWp</span><span>Ambient</span><span>${l.ambient} °C</span></div>
        <div class="price">${l.price ? m(l.price * E.effects(s).price) : 'Free'}</div>
        ${i === cur ? '<span class="tag">You are here</span>' : i < cur ? '<span class="tag">Outgrown</span>' : `<button class="btn primary" data-action="move" data-id="${l.id}">Move here</button>`}</div>`).join('')}</div>`;
    }
    const items = SHOP_TABS.find(([id]) => id === this.shopTab)[2];
    return `<div class="page-head"><div><h1>Vendors</h1><div class="muted">Brand new, full warranty, full price. Click any item to inspect it in 3D.</div></div>${tabs}</div>
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
    return `<div class="page-head"><div><h1>Inventory</h1><div class="muted">Cards and PSUs not installed in a rig. Install them from a rig's 3D workshop on the Floor.</div></div></div>
      <div class="grid">${inv.map((o) => {
        const spec = byId[o.id];
        return this.ownedCard(o, `<div class="row">
          <button class="btn" data-action="inspect" data-id="${o.id}" data-uid="${o.uid}">3D</button>
          ${this.repairBtn(o)}
          ${spec.kind === 'gpu' ? `<button class="btn" data-action="salvage" data-uid="${o.uid}">Salvage</button>` : ''}
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
          <span>Circuit</span><span class="${r.circuitPct > 0.9 ? 'bad' : ''}">${kw(r.demandWatts)} of ${r.location.circuitKw} kW</span></div>
          ${reg.loadShedding ? `<div class="small muted" style="margin:8px 0 4px">Next 24 hours</div><div class="shed">${sched.map((off, i) => `<i class="${off ? 'off' : ''} ${i === 0 ? 'now' : ''}" title="${(hour + i) % 24}:00"></i>`).join('')}</div>` : ''}</div>
        <div class="card"><h3>Backup & solar</h3><div class="kv">
          <span>Inverter</span><span class="${cap.inverterKw && cap.inverterKw < r.demandWatts / 1000 ? 'bad' : ''}">${cap.inverterKw ? `${cap.inverterKw} kW` : 'None'}</span>
          <span>Batteries</span><span>${cap.batteryKwh ? `${cap.batteryStored.toFixed(1)} / ${cap.batteryKwh.toFixed(1)} kWh` : 'None'}</span>
          <span>Solar</span><span>${cap.solarKwp ? `${cap.solarKwp} kWp · ${(cap.solarKwp * E.sunFactor(s)).toFixed(1)} kW now` : 'None'}</span>
          <span>Weather</span><span>${s.weather >= 1 ? '☀️ Sunny' : s.weather > 0.5 ? '⛅ Partly cloudy' : '☁️ Overcast'}</span>
          <span>Generator</span><span>${cap.generatorKw ? `${cap.generatorKw} kW` : 'None'}</span></div>
          ${cap.batteries.length ? `<label class="row small" style="margin-top:8px"><input type="checkbox" data-action="grid-charge" ${s.energy.gridCharge ? 'checked' : ''}> Charge batteries from the grid</label>` : ''}
          <button class="btn" style="margin-top:8px" data-action="nav" data-id="shop" onclick="window.hf.shopTab='energy'">Buy solar & backup</button></div>
        <div class="card"><h3>This month</h3><div class="kv">
          <span>Grid energy</span><span>${Math.round(s.power.gridKwh).toLocaleString()} kWh</span>
          <span>Grid cost</span><span>${m(s.power.gridCost)}</span><span>Diesel</span><span>${m(s.power.dieselCost)}</span>
          <span>Bill due</span><span>Day ${Math.floor(s.power.lastBillDay + 30) + 1}</span></div>
          ${bill ? `<div class="small muted" style="margin-top:8px">Last bill: ${Math.round(bill.kwh).toLocaleString()} kWh, ${m(bill.total)}</div>` : ''}</div>
      </div>`;
  }

  viewMarket() {
    const s = this.state; const m = this.money;
    return `<div class="page-head"><div><h1>Market</h1><div class="muted">Simulated prices: ${s.market.regime} market. Difficulty keeps rising; halvings cut SHA-256 rewards.</div></div></div>
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
        <div class="card"><h3>Game</h3><div class="small muted">Saved automatically in this browser. Space pauses; keys 1-4 change speed.</div>
          <button class="btn danger" style="margin-top:8px" data-action="new-game">Start a new game</button></div>
      </div>
      <p class="disclaimer" style="margin-top:16px">HashForge is a game. Hardware names identify real products and belong to their owners; HashForge is not affiliated with any manufacturer. Hash rates, prices and tariffs are approximations, and coin prices are simulated. Nothing here is financial advice.</p>`;
  }

  renderSide() {
    const s = this.state;
    const tips = E.advise(s).slice(0, 6);
    const reg = E.region(s);
    const sideHtml = `
      <div><h3 style="margin-bottom:8px">🤖 Advisor</h3>${tips.map((t) => `<div class="tip ${t.level}">${esc(this.fmt(t.text))}</div>`).join('<div style="height:6px"></div>')}</div>
      ${reg.loadShedding ? `<div><h3 style="margin-bottom:6px">Load-shedding ${s.grid.stage ? `<span class="warn">Stage ${s.grid.stage}</span>` : '<span class="good">off</span>'}</h3>
        <div class="shed">${E.sheddingSchedule(s, 24).map((off, i) => `<i class="${off ? 'off' : ''} ${i === 0 ? 'now' : ''}"></i>`).join('')}</div>
        <div class="small muted" style="margin-top:4px">Next 24 hours (red = no grid)</div></div>` : ''}
      <div><h3 style="margin-bottom:8px">Log</h3><div class="log">${s.log.slice(0, 14).map((l) => `<div class="${l.type}"><span class="muted">D${Math.floor(l.day) + 1}</span> ${esc(this.fmt(l.text))}</div>`).join('')}</div></div>`;
    if (sideHtml !== this.lastSideHtml) { this.lastSideHtml = sideHtml; $('#side').innerHTML = sideHtml; }
    if (s.gameOver && !this.shownGameOver) {
      this.shownGameOver = true;
      this.toast('Bankrupt! Start a new game from Settings, or Hard Fork if you qualified.', 'bad');
    }
  }

  // ---------------------------------------------------------------- 3D overlays

  async ensureViewer() {
    if (!this.viewer) {
      const { ProductViewer } = await import('../render/viewer.js');
      this.viewer = new ProductViewer($('#stage3d'));
    }
    return this.viewer;
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
    const key = JSON.stringify([rig.gpus.map((g) => g.uid + g.broken), rig.psus.map((p) => p.uid)]);
    if (rebuild || key !== this.rigKey) {
      this.rigKey = key;
      const model = makeRig(byId[rig.frameId], rig.gpus.map((g) => ({ spec: byId[g.id], q: g.q, broken: g.broken })), rig.psus.map((p) => ({ spec: byId[p.id], q: p.q })), { detail: 'full' });
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
      <h3>Power supplies (${rig.psus.length}/${frame.psuSlots})</h3>
      ${rig.psus.map((p) => line(p, `${this.repairBtn(p)}<button class="btn" data-action="uninstall" data-arg="${rig.uid}" data-uid="${p.uid}">Remove</button>`)).join('')}
      ${rig.psus.length < frame.psuSlots ? sparePsus.map((p) => line(p, `<button class="btn primary" data-action="install" data-arg="${rig.uid}" data-uid="${p.uid}">Install</button>`)).join('') || '<div class="muted small">No spare PSUs. Buy one from Vendors or the Used market.</div>' : ''}
      <h3>GPUs (${rig.gpus.length}/${frame.slots})</h3>
      ${rig.gpus.map((g) => line(g, `${this.repairBtn(g)}<button class="btn" data-action="uninstall" data-arg="${rig.uid}" data-uid="${g.uid}">Remove</button>`)).join('')}
      ${rig.gpus.length < frame.slots ? spareGpus.map((g) => line(g, `<button class="btn primary" data-action="install" data-arg="${rig.uid}" data-uid="${g.uid}">Install</button>`)).join('') || '<div class="muted small">No spare GPUs in inventory.</div>' : ''}
      ${!rig.gpus.length && !rig.psus.length ? `<button class="btn danger" data-action="sell" data-uid="${rig.uid}">Sell rig kit</button>` : ''}`;
  }

  async openTour() {
    this.openOverlay('3D Tour');
    this.overlayMode = { type: 'tour' };
    if (this.viewer) this.viewer.renderer.domElement.style.display = 'none';
    $('#stage3d').querySelector('.stage-ctrl')?.remove();
    const { MiningRoom } = await import('../render/scene.js');
    this.tour = new MiningRoom($('#stage3d'), { onSelect: (pick) => { if (pick.type === 'rig') { this.closeOverlay(); this.openRig(pick.uid); } } });
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
