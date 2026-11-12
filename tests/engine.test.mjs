import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALGOS, ASICS, GPUS, PSUS, REGIONS, byId } from '../js/data/catalog.js';
import { QUALITY, JUNK_LOTS, UPGRADES, forkThreshold } from '../js/data/progression.js';
import * as E from '../js/sim/engine.js';

const fresh = (opts = {}) => E.newGame(12345, opts);
const rich = (opts) => { const s = fresh(opts); s.cash = 1e7; return s; };

function starterRig(state, gpuId = 'rtx3060ti', count = 6, psuId = 'psu1000g', frame = 'frame6') {
  const rig = E.buy(state, frame);
  assert.ok(rig.ok, rig.error);
  const psu = E.buy(state, psuId);
  assert.ok(E.installPsu(state, rig.uid, psu.uid).ok);
  const boot = E.buy(state, 'usb16');
  assert.ok(E.installBoot(state, rig.uid, boot.uid).ok);
  for (let i = 0; i < count; i++) {
    const g = E.buy(state, gpuId);
    assert.ok(g.ok, g.error);
    assert.ok(E.installGpu(state, rig.uid, g.uid).ok);
  }
  return state.rigs.find((r) => r.uid === rig.uid);
}

// ------------------------------------------------------------------ catalog & currency

test('catalog is complete and consistent', () => {
  assert.ok(GPUS.length >= 30 && ASICS.length >= 15 && PSUS.length >= 6);
  for (const g of GPUS) {
    assert.ok(g.power <= g.tdp, `${g.name}: tuned power must not exceed TDP`);
    for (const a of ['kawpow', 'etchash', 'autolykos']) assert.ok(g.hash[a] > 0);
  }
  const eff = (id) => byId[id].power / byId[id].hashrate;
  assert.ok(eff('s21xp') < eff('s21') && eff('s21') < eff('s19xp') && eff('s19xp') < eff('s9'));
});

test('South Africa uses Rand tariffs converted at the exchange rate', () => {
  const s = fresh({ region: 'za', tariffLocal: 3.8, fx: 19 });
  assert.equal(E.region(s).currency, 'ZAR');
  assert.ok(Math.abs(E.tariffUsd(s) - 3.8 / 19) < 1e-9);
  E.setFx(s, 17);
  assert.ok(Math.abs(E.tariffUsd(s) - 3.8 / 17) < 1e-9);
  assert.ok(E.setTariff(s, 4.5).ok && s.tariffLocal === 4.5);
  assert.equal(E.setTariff(s, -1).ok, false);
});

// ------------------------------------------------------------------ building

test('a starter rig mines profitably in South Africa', () => {
  const s = fresh();
  starterRig(s);
  const room = E.roomStats(s);
  const cost = room.demandWatts / 1000 * 24 * E.tariffUsd(s);
  assert.ok(room.grossPerDay > cost, `gross ${room.grossPerDay.toFixed(2)} vs power ${cost.toFixed(2)}`);
});

test('an undersized PSU stops the rig from booting', () => {
  const s = rich();
  const rig = starterRig(s, 'rtx3090', 4, 'psu650b');
  assert.equal(E.rigStats(s, rig).status, 'overloaded');
  assert.ok(E.advise(s).some((t) => /won't boot/.test(t.text)));
});

test('ASICs need a rack, and a rack PDU can be overloaded', () => {
  const s = rich();
  assert.match(E.buy(s, 's21').error, /need a rack/);
  E.buy(s, 'shelf');                       // 2 units, 4 kW PDU
  assert.ok(E.buy(s, 's21').ok);
  assert.ok(E.buy(s, 's19jpro').ok);
  assert.match(E.buy(s, 's9').error, /full/);
  const rack = E.rackStats(s, s.racks[0]);
  assert.ok(rack.overloaded, '6.6 kW on a 4 kW PDU');
  assert.equal(rack.miners.every((m) => !m.running), true);
});

test('auto algorithm and autoFill pick the most profitable options', () => {
  const s = rich();
  const rig = starterRig(s);
  s.market.index.kawpow = 5; s.market.index.etchash = 0.3; s.market.index.autolykos = 0.3;
  assert.equal(E.rigStats(s, rig).algo, 'kawpow');
  const r2 = E.buy(s, 'frame4');
  for (const id of ['psu650b', 'psu1300g', 'rx570', 'rtx3070', 'rtx3060ti', 'rx6600', 'rtx3080', 'ssd120']) E.buy(s, id);
  E.autoFill(s, r2.uid);
  const filled = s.rigs.find((r) => r.uid === r2.uid);
  assert.equal(filled.psus[0].id, 'psu1300g');
  assert.equal(filled.gpus.length, 4);
  assert.ok(filled.gpus.some((g) => g.id === 'rtx3080'));
  assert.equal(filled.boot.id, 'ssd120', 'autoFill installs a boot drive');
});

// ------------------------------------------------------------------ quality, wear, repair

test('quality grades change hashrate and power', () => {
  const s = fresh();
  const golden = E.gpuEffective(s, { id: 'rtx3070', q: 'golden', cond: 1 });
  const scrap = E.gpuEffective(s, { id: 'rtx3070', q: 'scrap', cond: 1 });
  const worn = E.gpuEffective(s, { id: 'rtx3070', q: 'new', cond: 0.2 });
  assert.ok(golden.hash.kawpow > byId.rtx3070.hash.kawpow && golden.power < byId.rtx3070.power);
  assert.ok(scrap.hash.kawpow < worn.hash.kawpow && scrap.power > byId.rtx3070.power);
  assert.ok(worn.hash.kawpow < byId.rtx3070.hash.kawpow);
});

test('hot, cheap hardware wears out and fails; repair brings it back', () => {
  const s = rich();
  s.mods.ambient = 18;                     // brutal heat
  const rig = E.buy(s, 'frame8');
  E.installPsu(s, rig.uid, E.buy(s, 'psu2000t').uid);
  E.installBoot(s, rig.uid, E.buy(s, 'nvme256').uid);
  for (let i = 0; i < 8; i++) {
    s.inventory.push({ uid: `scrap${i}`, id: 'rtx3070', q: 'scrap', cond: 0.4, broken: false, boughtDay: 0 });
    E.installGpu(s, rig.uid, `scrap${i}`);
  }
  E.advance(s, 24 * 120);
  const r = s.rigs[0];
  const broken = r.gpus.filter((g) => g.broken);
  assert.ok(broken.length > 0, 'scrap cards in heat should fail');
  const cash = s.cash;
  const res = E.repair(s, broken[0].uid);
  assert.ok(res.ok && s.cash === cash - res.cost && !broken[0].broken);
});

// ------------------------------------------------------------------ junkyard & crafting

test('junkyard lots produce parts and cards; better lots give better grades', () => {
  const avgRank = (lotId) => {
    const s = rich();
    let sum = 0; let n = 0;
    for (let i = 0; i < 30; i++) {
      const res = E.buyLot(s, lotId);
      assert.ok(res.ok);
      for (const f of res.found) { sum += QUALITY[f.q].rank; n++; }
    }
    return sum / n;
  };
  assert.ok(avgRank('rma') > avgRank('binbox') + 0.8);
});

test('crafting a GPU from matching parts', () => {
  const s = rich();
  const mk = (type, extra) => { const p = { uid: `p${type}`, type, model: 'rtx3070', q: 'refurb', ...extra }; s.parts.push(p); return p.uid; };
  const core = mk('core');
  const memory = mk('memory', { memType: 'GDDR6', vram: 8 });
  const pcb = mk('pcb', { gen: 'RTX 30' });
  const cooler = mk('cooler', { fans: 2 });
  s.parts.push({ uid: 'wrongpcb', type: 'pcb', model: 'rx6600', q: 'new', gen: 'RX 6000' });
  assert.equal(E.craftGpu(s, { core, memory, pcb: 'wrongpcb', cooler }).ok, false);
  const res = E.craftGpu(s, { core, memory, pcb, cooler });
  assert.ok(res.ok, res.error);
  const card = s.inventory.find((x) => x.uid === res.uid);
  assert.equal(card.id, 'rtx3070');
  assert.ok(['refurb', 'golden'].includes(card.q));
  assert.equal(s.parts.length, 1, 'only the wrong PCB is left');
});

test('salvage turns a card into parts', () => {
  const s = rich();
  const g = E.buy(s, 'rtx4070');
  const res = E.salvage(s, g.uid);
  assert.ok(res.ok && res.parts.length === 4);
  assert.ok(res.parts.every((p) => p.model === 'rtx4070'));
});

test('used marketplace refreshes and sells graded hardware', () => {
  const s = rich();
  assert.equal(s.listings.length, 10);
  E.buy(s, 'shelf'); E.buy(s, 'shelf');
  const l = s.listings.find((x) => byId[x.itemId].kind === 'gpu');
  const res = E.buyListing(s, l.id);
  assert.ok(res.ok, res.error);
  const card = s.inventory.find((x) => x.uid === res.uid);
  assert.equal(card.q, l.q);
  E.advance(s, 24 * 10);
  assert.equal(s.listings.length, 10);
});

// ------------------------------------------------------------------ power: grid, load-shedding, solar, batteries

test('overloading the circuit trips the breaker', () => {
  const s = rich();
  E.buy(s, 'shelf');
  E.buy(s, 's21');
  starterRig(s, 'rtx3060ti', 2);
  E.advance(s, 2);
  assert.equal(s.grid.breakerTripped, true);
  assert.equal(E.roomStats(s).grossPerDay, 0);
  assert.equal(E.resetBreaker(s).ok, false);
  E.toggle(s, s.racks[0].asics[0].uid);
  assert.ok(E.resetBreaker(s).ok);
});

test('load-shedding takes miners offline without backup power', () => {
  const s = rich();
  starterRig(s);
  s.grid.stage = 6; s.grid.stageDaysLeft = 999;
  const hoursOff = E.sheddingSchedule(s, 24).filter(Boolean).length;
  assert.equal(hoursOff, E.SHED_BLOCKS[6] * 2);
  const before = s.stats.minedUsd;
  E.advance(s, 24);
  const fullDay = E.roomStats(s).grossPerDay;
  const mined = s.stats.minedUsd - before;
  assert.ok(Math.abs(mined - fullDay * (24 - hoursOff) / 24) / fullDay < 0.05, `mined ${mined} of ${fullDay}`);
});

test('inverter + batteries ride through load-shedding; an undersized inverter trips', () => {
  const s = rich();
  starterRig(s);                          // ~0.9 kW
  s.grid.stage = 4; s.grid.stageDaysLeft = 999;
  E.buy(s, 'inv3'); E.buy(s, 'lfp15');
  s.energy.batteries[0].soc = 15;
  const fullDay = E.roomStats(s).grossPerDay;
  const before = s.stats.minedUsd;
  E.advance(s, 24);
  assert.ok(s.stats.minedUsd - before > fullDay * 0.97, 'mined through every outage');
  assert.ok(s.energy.batteries[0].wear > 0, 'battery wears');

  const t = rich();
  starterRig(t); starterRig(t, 'rtx3060ti', 6);   // ~1.8 kW
  E.buy(t, 'shelf'); E.buy(t, 's19jpro');          // +3 kW
  E.buy(t, 'inv3'); E.buy(t, 'lfp15');
  t.energy.batteries[0].soc = 15;
  t.grid.stage = 8; t.grid.stageDaysLeft = 999;
  assert.ok(E.advise(t).some((x) => /bigger than your inverter/.test(x.text)));
  const r = E.dispatchHour({ ...t, hours: 7 }, 4.8);
  assert.equal(r.supplied, false);
  assert.match(r.reason, /Inverter overloaded/);
});

test('solar only works with an inverter, follows the sun and cuts the grid bill', () => {
  const s = rich();
  assert.ok(E.buy(s, 'panel4').ok && E.buy(s, 'panel4').ok);   // 4.4 kWp fills the bedroom roof
  let noon = E.dispatchHour({ ...s, hours: 12 }, 2);
  assert.equal(noon.solarUsed, 0, 'no inverter, no solar');
  E.buy(s, 'inv8');
  s.weather = 1;
  noon = E.dispatchHour({ ...s, hours: 12 }, 2);
  const night = E.dispatchHour({ ...s, hours: 23 }, 2);
  assert.ok(noon.solarUsed > 1.9 && noon.gridKwh < 0.1);
  assert.equal(night.solarUsed, 0);
  assert.ok(night.gridKwh >= 2);
  assert.match(E.buy(s, 'panel4').error ?? '', /roof/i, 'no roof space left');
});

test('a generator covers outages but burns diesel', () => {
  const s = rich();
  starterRig(s);
  s.grid.outageHours = 6;
  E.buy(s, 'generator');
  const before = s.stats.minedUsd;
  E.advance(s, 6);
  assert.ok(s.stats.minedUsd > before);
  assert.ok(s.power.dieselCost > 0);
});

// ------------------------------------------------------------------ economy & prestige

test('bills arrive every 30 days and match grid energy', () => {
  const s = fresh();
  starterRig(s);
  s.grid.stage = 0; s.grid.stageDaysLeft = 999;
  const kw = E.roomStats(s).demandWatts / 1000;
  E.advance(s, 24 * 29);
  assert.equal(s.stats.powerPaid, 0);
  E.advance(s, 24 * 2);
  assert.ok(s.lastBill && s.stats.powerPaid > 0);
  const expectedKwh = kw * 24 * 30;
  assert.ok(Math.abs(s.lastBill.kwh - expectedKwh) / expectedKwh < 0.1, `${s.lastBill.kwh} kWh vs ${expectedKwh}`);
});

test('the market moves, difficulty rises and halvings happen', () => {
  const s = fresh();
  E.advance(s, 24 * 700);
  for (const a of Object.keys(ALGOS)) assert.ok(s.market.difficulty[a] > 1.1, `${a} difficulty rises`);
  assert.equal(s.market.halvings, 1);
});

test('a sensible strategy usually grows net worth over a game year (but not always)', () => {
  let wins = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = E.newGame(seed);
    const rig = starterRig(s);
    E.buy(s, 'boxfan');
    // A sensible player checks in monthly: replaces dead boot drives and risers, repairs cards, cleans dust.
    for (let month = 0; month < 12; month++) {
      E.advance(s, 24 * 30.4);
      if (rig.boot?.broken && s.cash > 10) E.installBoot(s, rig.uid, E.buy(s, 'usb16').uid);
      rig.risers.forEach((r, k) => { if (r.broken && s.cash > 10) E.swapRiser(s, rig.uid, k, E.buy(s, 'riser009s').uid); });
      [...rig.gpus, ...rig.psus].forEach((g) => { if (g.broken && s.cash > E.repairCost(s, g)) E.repair(s, g.uid); });
      if (s.dust > 0.4 && s.cash > E.cleanCost(s)) E.cleanDust(s);
    }
    if (E.netWorth(s) > 2500) wins++;
  }
  assert.ok(wins >= 6 && wins <= 12, `won ${wins}/12`);
});

test('hard fork resets the run but keeps shards and upgrades, and the next era is harder', () => {
  const s = fresh();
  assert.equal(E.hardFork(s).ok, false);
  s.cash = forkThreshold(0) * 4;
  const res = E.hardFork(s);
  assert.ok(res.ok && res.reward >= 20);
  const next = res.state;
  assert.equal(next.prestige.forks, 1);
  assert.equal(next.prestige.shards, res.reward);
  assert.ok(next.market.difficulty.sha256 > 1);
  assert.ok(E.buyUpgrade(next, 'capital').ok && E.buyUpgrade(next, 'firmware').ok);
  const after = E.hardFork({ ...next, cash: forkThreshold(1) * 2 }).state;
  assert.equal(after.cash, 2500 + 2500);
  assert.ok(E.effects(after).hash > 1);
  assert.ok(forkThreshold(2) > forkThreshold(1), 'goals keep growing');
});

test('upgrades level forever with growing costs', () => {
  const s = fresh();
  s.prestige.shards = 1e6;
  for (let i = 0; i < 25; i++) assert.ok(E.buyUpgrade(s, 'contracts').ok);
  assert.equal(s.prestige.upgrades.contracts, 25);
  assert.ok(E.effects(s).tariff >= 0.35, 'tariff discount is capped');
  assert.equal(UPGRADES.length >= 8, true);
});

test('bankruptcy ends the game', () => {
  const s = fresh();
  s.cash = -9990; s.power.gridCost = 500; s.power.lastBillDay = -30;
  E.advance(s, 24);
  assert.equal(s.gameOver, true);
});

test('same seed replays identically and saves round-trip', () => {
  const a = E.newGame(42); const b = E.newGame(42);
  starterRig(a); starterRig(b);
  E.advance(a, 24 * 200); E.advance(b, 24 * 200);
  assert.equal(a.cash, b.cash);
  assert.deepEqual(E.deserialize(E.serialize(a)), a);
  assert.throws(() => E.deserialize(JSON.stringify({ version: 1 })));
});

test('fractional time steps add up exactly', () => {
  const s = fresh();
  for (let i = 0; i < 480; i++) E.advance(s, 0.1);
  assert.ok(s.hours >= 47 && s.hours <= 48);
});

test('regions exist for currency detection', () => {
  assert.ok(REGIONS.find((r) => r.id === 'za' && r.loadShedding && r.symbol === 'R'));
  assert.ok(JUNK_LOTS.length >= 4);
});

// ------------------------------------------------------------------ v0.1.1 realism

test('a rig without a boot drive will not mine', () => {
  const s = rich();
  const rig = E.buy(s, 'frame4');
  E.installPsu(s, rig.uid, E.buy(s, 'psu850g').uid);
  E.installGpu(s, rig.uid, E.buy(s, 'rtx3060ti').uid);
  assert.equal(E.rigStats(s, s.rigs[0]).status, 'no-boot');
  assert.ok(E.advise(s).some((t) => /boot drive/.test(t.text)));
  E.installBoot(s, rig.uid, E.buy(s, 'usb16').uid);
  assert.equal(E.rigStats(s, s.rigs[0]).status, 'mining');
});

test('rig kits ship with risers; a dead riser drops its card; swapping fixes it', () => {
  const s = rich();
  const rig = starterRig(s, 'rtx3060ti', 2);
  assert.equal(rig.risers.length, 6);
  const full = E.rigStats(s, rig).hashrate;
  rig.risers[0].broken = true;
  const after = E.rigStats(s, rig);
  assert.equal(after.deadRisers, 1);
  assert.ok(Math.abs(after.hashrate - full / 2) < 1e-6);
  const fresh = E.buy(s, 'riser011pro');
  assert.ok(E.swapRiser(s, rig.uid, 0, fresh.uid).ok);
  assert.ok(Math.abs(E.rigStats(s, rig).hashrate - full) < 1e-6);
});

test('SATA-powered risers can start fires', () => {
  let fires = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const s = E.newGame(seed); s.cash = 1e7;
    const rig = starterRig(s, 'rtx3080', 6, 'psu1600p');
    for (let k = 0; k < 6; k++) E.swapRiser(s, rig.uid, k, E.buy(s, 'riser009sata').uid);
    E.buy(s, 'portac');
    E.advance(s, 24 * 200);
    if (s.log.some((l) => /FIRE/.test(l.text))) fires++;
  }
  assert.ok(fires >= 1, 'with six SATA risers on 230 W cards, fires happen');
});

test('Windows: licence, overhead, 8-GPU limit and an NVIDIA overclock bonus', () => {
  const s = rich();
  const rig = starterRig(s, 'rtx3070', 4);
  const linux = E.rigStats(s, rig);
  const cash = s.cash;
  assert.ok(E.setOs(s, rig.uid, 'windows').ok);
  assert.equal(s.cash, cash - 139);
  const win = E.rigStats(s, rig);
  assert.ok(win.hashrate > linux.hashrate && win.dcLoad === linux.dcLoad + 35);
  E.setOs(s, rig.uid, 'linux'); E.setOs(s, rig.uid, 'windows');
  assert.equal(s.cash, cash - 139, 'licence is paid once');
  s.cash = 1e7; E.moveTo(s, 'garage');
  const big = starterRig(s, 'rx6600', 12, 'psu2000t', 'frame12');
  E.setOs(s, big.uid, 'windows');
  assert.equal(E.rigStats(s, big).overOsLimit, 4);
});

test('thermal pads stop GDDR6X memory throttling; shims need pads first', () => {
  const s = rich();
  const g = E.buy(s, 'rtx3090');
  const card = s.inventory.find((x) => x.uid === g.uid);
  const before = E.gpuEffective(s, card);
  assert.ok(before.memThrottled);
  const shim = E.buy(s, 'shim');
  assert.match(E.applyMod(s, g.uid, shim.uid).error, /pads first/);
  assert.ok(E.applyMod(s, g.uid, E.buy(s, 'pads').uid).ok);
  const padded = E.gpuEffective(s, card);
  assert.ok(!padded.memThrottled && padded.hash.kawpow > before.hash.kawpow * 1.15);
  assert.ok(E.applyMod(s, g.uid, shim.uid).ok);
  assert.ok(E.gpuEffective(s, card).hash.kawpow > padded.hash.kawpow);
  const plainUid = E.buy(s, 'rtx3060ti').uid;
  const gddr6 = s.inventory.find((x) => x.uid === plainUid);
  assert.equal(E.gpuEffective(s, gddr6).memThrottled, false);
});

test('dust builds up and cuts cooling; filters slow it; cleaning resets it', () => {
  const run = (filters) => {
    const s = rich();
    starterRig(s); E.buy(s, 'portac');
    if (filters) assert.ok(E.buyFacility(s, 'filters').ok);
    E.advance(s, 24 * 60);
    return s;
  };
  const dirty = run(false); const filtered = run(true);
  assert.ok(dirty.dust > filtered.dust * 2);
  const capDirty = E.roomStats(dirty).coolingCapacity;
  assert.ok(E.cleanDust(dirty).ok);
  assert.ok(E.roomStats(dirty).coolingCapacity > capDirty);
});

test('aisle containment boosts cooling; evaporative coolers struggle on humid days', () => {
  const s = rich();
  E.buy(s, 'evap');
  s.weather = 1;
  const dry = E.roomStats(s).coolingCapacity;
  s.weather = 0.25;
  assert.ok(Math.abs(E.roomStats(s).coolingCapacity - dry / 2) < 1e-6);
  s.weather = 1;
  assert.ok(E.buyFacility(s, 'containment').ok);
  assert.ok(Math.abs(E.roomStats(s).coolingCapacity - dry * 1.25) < 1e-6);
});

test('hot ASICs draw more power for the same hashrate', () => {
  const s = rich();
  E.buy(s, 'shelf'); E.buy(s, 's21');
  s.lastDeviceTemp = 50;
  const cool = E.rackStats(s, s.racks[0]).load;
  s.lastDeviceTemp = 90;
  assert.ok(E.rackStats(s, s.racks[0]).load > cool * 1.2);
});

test('South African daytime surplus tariff: cheap by day, dear at night', () => {
  const s = rich();
  assert.equal(E.tariffHourMult(s, 12), 1);
  assert.ok(E.setTariffPlan(s, 'daytime').ok);
  assert.ok(E.tariffHourMult(s, 12) < 0.6 && E.tariffHourMult(s, 22) > 1);
  const us = rich({ region: 'us' });
  assert.equal(E.setTariffPlan(us, 'daytime').ok, false);
});

test('old v2 saves load with risers and a boot drive added', () => {
  const s = rich();
  const rig = starterRig(s);
  const old = structuredClone(s);
  old.version = 2;
  delete old.rigs[0].risers; delete old.rigs[0].boot; delete old.dust; delete old.facility;
  const loaded = E.deserialize(JSON.stringify(old));
  assert.equal(loaded.version, E.SAVE_VERSION);
  assert.equal(loaded.rigs[0].risers.length, 6);
  assert.ok(loaded.rigs[0].boot);
  assert.equal(E.rigStats(loaded, loaded.rigs[0]).status, 'mining');
  assert.ok(rig);
});

test('goals guide a new player and pay out once', () => {
  const s = E.newGame(11);
  assert.equal(E.currentGoal(s).id, 'rig');
  const cash0 = s.cash;
  const rig = E.buy(s, 'frame4');
  const done = E.checkGoals(s);
  assert.deepEqual(done.map((g) => g.id), ['rig']);
  assert.ok(Math.abs(s.cash - (cash0 - rig.price + 25)) < 1e-6, 'reward paid');
  assert.equal(E.checkGoals(s).length, 0, 'no double payout');
  E.buy(s, 'psu1000g'); E.buy(s, 'rtx3060ti'); E.buy(s, 'usb16');
  E.autoFill(s, rig.uid);
  const ids = E.checkGoals(s).map((g) => g.id);
  for (const id of ['psu', 'gpu', 'boot', 'mining']) assert.ok(ids.includes(id), `${id} completes`);
});

test('old saves tick off finished goals without paying again', () => {
  const s = E.newGame(12);
  E.buy(s, 'frame4');
  delete s.goals;
  const cash = s.cash;
  E.checkGoals(s);
  assert.equal(s.cash, cash);
  assert.ok(s.goals.done.includes('rig'));
});

test('endless milestones double after the guided goals', () => {
  const s = E.newGame(13);
  s.goals = { done: E.GOALS.map((g) => g.id), tier: 0 };
  const a = E.currentGoal(s);
  s.goals.tier = 1;
  const b = E.currentGoal(s);
  assert.ok(a.endless && b.endless);
  assert.equal(b.reward, a.reward * 2);
});

test('repeated log lines collapse into a counter', () => {
  const s = E.newGame(14);
  const r = E.buy(s, 'frame4'); E.buy(s, 'psu1000g'); E.buy(s, 'rtx3060ti'); E.buy(s, 'usb16'); E.autoFill(s, r.uid);
  E.advance(s, 24 * 120);
  for (let i = 1; i < s.log.length; i++) assert.notEqual(s.log[i].text, s.log[i - 1].text, 'no identical neighbours');
});

test('offline catch-up is capped at a game week', () => {
  const s = E.newGame(15);
  assert.equal(E.catchUp(s, 30 * 1000), null, 'under a minute does nothing');
  const r = E.catchUp(s, 48 * 3600 * 1000);
  assert.equal(r.hours, 7 * 24);
});

// ---------------------------------------------------------------- servers and hosting
function miniServer(s) {
  s.cash = 1e5;
  const box = E.buy(s, 'nuc13pro');
  E.buy(s, 'so4_16'); E.buy(s, 'so4_16'); E.buy(s, 'sn850x1'); E.buy(s, '990pro2');
  E.autoFillServer(s, box.uid);
  return s.servers.find((m) => m.uid === box.uid);
}

test('a mini PC builds from parts and checks compatibility', () => {
  const s = E.newGame(21); s.cash = 1e5;
  const box = E.buy(s, 'nuc13pro');
  const m = s.servers[0];
  assert.equal(E.serverStats(s, m).status, 'no-ram');
  const d5 = E.buy(s, 'd5_32');
  assert.ok(!E.installServerPart(s, box.uid, d5.uid).ok, 'desktop DDR5 does not fit a SO-DIMM board');
  const hdd = E.buy(s, 'exos18');
  assert.ok(!E.installServerPart(s, box.uid, hdd.uid).ok, 'no 3.5" bay in a NUC');
  E.installServerPart(s, box.uid, E.buy(s, 'so4_16').uid);
  assert.equal(E.serverStats(s, m).status, 'no-drive');
  E.installServerPart(s, box.uid, E.buy(s, 'sn850x1').uid);
  const st = E.serverStats(s, m);
  assert.equal(st.status, 'running');
  assert.equal(st.vcpu, 16); assert.equal(st.ramGB, 16);
  assert.ok(st.wallPower > 5 && st.wallPower < 80);
});

test('a tower needs a matching board, CPU, RAM and PSU', () => {
  const s = E.newGame(22); s.cash = 1e5;
  const box = E.buy(s, 'north');
  const intelCpu = E.buy(s, 'i5_12400');
  const board = E.buy(s, 'b650ma');
  assert.ok(E.installServerPart(s, box.uid, board.uid).ok);
  assert.ok(!E.installServerPart(s, box.uid, intelCpu.uid).ok, 'LGA1700 CPU on an AM5 board');
  assert.ok(E.installServerPart(s, box.uid, E.buy(s, 'r5_7600').uid).ok);
  assert.ok(!E.installServerPart(s, box.uid, E.buy(s, 'd4_16').uid).ok, 'DDR4 on a DDR5 board');
  E.installServerPart(s, box.uid, E.buy(s, 'd5_16').uid);
  E.installServerPart(s, box.uid, E.buy(s, 'redplus4').uid);
  assert.equal(E.serverStats(s, s.servers[0]).status, 'no-psu');
  E.installServerPart(s, box.uid, E.buy(s, 'psu650b').uid);
  assert.equal(E.serverStats(s, s.servers[0]).status, 'running');
});

test('clients sign on, pay daily and leave over downtime', () => {
  const s = E.newGame(23);
  const m = miniServer(s);
  s.offers = [];
  E.refreshOffers(s, true);
  const offer = s.offers.find((o) => !E.fitProblem(s, m, o.needs));
  assert.ok(offer, 'a fitting offer exists at reputation 0');
  assert.ok(E.acceptOffer(s, offer.id).ok);
  assert.equal(s.clients.length, 1);
  const cash = s.cash; const before = s.stats.hostingUsd || 0;
  E.advance(s, 24 * 10);
  assert.ok(s.stats.hostingUsd > before, 'hosting earns');
  assert.ok(Number.isFinite(s.cash) && s.cash !== cash);
  // Switch the machine off: the client gets unhappy and eventually cancels.
  m.on = false;
  E.advance(s, 24 * 10);
  assert.equal(s.clients.length, 0, 'client left after days of downtime');
});

test('a UPS keeps servers up through an outage', () => {
  const s = E.newGame(24);
  const m = miniServer(s);
  E.buy(s, 'smt1500');
  E.refreshOffers(s, true);
  const offer = s.offers.find((o) => !E.fitProblem(s, m, o.needs));
  E.acceptOffer(s, offer.id);
  s.grid.outageHours = 3;
  E.advance(s, 3);
  assert.equal(s.clients[0].upToday, s.clients[0].hoursToday, 'no downtime with a charged UPS');
});

test('drive protection survives one dead drive; without it data is lost', () => {
  const s = E.newGame(25); s.cash = 1e5;
  const nas = E.buy(s, 'ds224');
  E.installServerPart(s, nas.uid, E.buy(s, 'redplus4').uid);
  E.installServerPart(s, nas.uid, E.buy(s, 'redplus4').uid);
  const m = s.servers[0];
  assert.equal(E.serverStats(s, m).usableTb, 8);
  assert.ok(E.setRaid(s, nas.uid, true).ok);
  assert.equal(E.serverStats(s, m).usableTb, 4);
  m.drives[0].broken = true;
  assert.equal(E.serverStats(s, m).status, 'degraded');
  m.raid = false;
  assert.equal(E.serverStats(s, m).status, 'data-loss');
});

test('servers count toward room power and net worth, and sell with their parts', () => {
  const s = E.newGame(26);
  const m = miniServer(s);
  const room = E.roomStats(s);
  assert.ok(room.serverWatts > 0 && room.demandWatts >= room.serverWatts);
  const worth = E.netWorth(s);
  const res = E.sell(s, m.uid);
  assert.ok(res.ok && res.value > 0);
  assert.ok(Math.abs(E.netWorth(s) - worth) < 1, 'selling converts parts to cash at their value');
});

test('v3 saves migrate to v4 with hosting fields', () => {
  const s = E.newGame(27);
  delete s.servers; delete s.clients; delete s.offers; delete s.reputation; delete s.energy.ups; s.version = 3;
  const m = E.deserialize(JSON.stringify(s));
  assert.equal(m.version, E.SAVE_VERSION);
  assert.ok(Array.isArray(m.servers) && m.offers.length > 0);
});
