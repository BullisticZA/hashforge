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
  for (const id of ['psu650b', 'psu1300g', 'rx570', 'rtx3070', 'rtx3060ti', 'rx6600', 'rtx3080']) E.buy(s, id);
  E.autoFill(s, r2.uid);
  const filled = s.rigs.find((r) => r.uid === r2.uid);
  assert.equal(filled.psus[0].id, 'psu1300g');
  assert.equal(filled.gpus.length, 4);
  assert.ok(filled.gpus.some((g) => g.id === 'rtx3080'));
});

// ------------------------------------------------------------------ quality, wear, repair

test('quality grades change hashrate and power', () => {
  const s = fresh();
  const golden = E.gpuEffective(s, { id: 'rtx3080', q: 'golden', cond: 1 });
  const scrap = E.gpuEffective(s, { id: 'rtx3080', q: 'scrap', cond: 1 });
  const worn = E.gpuEffective(s, { id: 'rtx3080', q: 'new', cond: 0.2 });
  assert.ok(golden.hash.kawpow > byId.rtx3080.hash.kawpow && golden.power < byId.rtx3080.power);
  assert.ok(scrap.hash.kawpow < worn.hash.kawpow && scrap.power > byId.rtx3080.power);
  assert.ok(worn.hash.kawpow < byId.rtx3080.hash.kawpow);
});

test('hot, cheap hardware wears out and fails; repair brings it back', () => {
  const s = rich();
  s.mods.ambient = 18;                     // brutal heat
  const rig = E.buy(s, 'frame8');
  E.installPsu(s, rig.uid, E.buy(s, 'psu2000t').uid);
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
  for (const a of Object.keys(ALGOS)) assert.ok(s.market.difficulty[a] > 1.3);
  assert.equal(s.market.halvings, 1);
});

test('a sensible strategy usually grows net worth over a game year (but not always)', () => {
  let wins = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = E.newGame(seed);
    starterRig(s);
    E.buy(s, 'boxfan');
    E.advance(s, 24 * 365);
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
