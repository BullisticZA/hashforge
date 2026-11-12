import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as E from '../js/sim/engine.js';
import * as C from '../js/sim/career.js';

const fresh = () => E.newGame(4242, { region: 'za', tariffLocal: 3.8, fx: 19 });

function miningSetup(s) {
  const rig = E.buy(s, 'frame6');
  E.installPsu(s, rig.uid, E.buy(s, 'psu1000g').uid);
  E.installBoot(s, rig.uid, E.buy(s, 'usb16').uid);
  for (let i = 0; i < 4; i++) E.installGpu(s, rig.uid, E.buy(s, 'rtx3060ti').uid);
}

test('earnings give XP and levels pay a cash bonus', () => {
  const s = fresh(); s.cash = 50000;
  C.tick(s);
  assert.equal(s.career.level, 1);
  const cash = s.cash;
  const ups = C.grantXp(s, C.xpToNext(1) + C.xpToNext(2) + 1);
  assert.deepEqual(ups.map((u) => u.level), [2, 3]);
  assert.equal(s.cash, cash + C.levelReward(2) + C.levelReward(3));
  assert.equal(C.rankOf(1), 'Bedroom Miner');
  assert.equal(C.rankOf(9), 'Hash Hustler');
});

test('mining income turns into XP over time', () => {
  const s = fresh(); s.cash = 50000;
  miningSetup(s);
  C.tick(s);
  const before = s.career.totalXp;
  E.advance(s, 24 * 5);
  C.tick(s);
  assert.ok(s.career.totalXp > before, 'XP should grow with mining income');
});

test('the contract board fills up, finishes jobs and pays on claim', () => {
  const s = fresh(); s.cash = 50000;
  miningSetup(s);
  C.tick(s);
  assert.equal(s.career.jobs.length, C.jobSlots(1));
  // Force a simple contract and complete it.
  const job = { id: 'Jx', tpl: 'buy', title: 'Buy 2 pieces of hardware', metric: 'bought', target: 2, base: s.stats.bought, endsDay: 5, reward: 40, xp: 10, done: false };
  s.career.jobs[0] = job;
  E.buy(s, 'usb16'); E.buy(s, 'usb16');
  const out = C.tick(s);
  assert.ok(out.jobs.some((j) => j.id === 'Jx'));
  const cash = s.cash;
  const res = C.claimJob(s, 'Jx');
  assert.ok(res.ok);
  assert.equal(s.cash, cash + 40);
  assert.equal(s.career.jobsDone, 1);
  C.tick(s);
  assert.equal(s.career.jobs.length, C.jobSlots(1) - 1, 'no instant replacement: the board refills each morning');
  E.advance(s, 24);
  C.tick(s);
  assert.equal(s.career.jobs.length, C.jobSlots(s.career.level), 'a new contract arrives the next day');
});

test('unfinished contracts expire, finished ones wait to be claimed', () => {
  const s = fresh(); s.cash = 50000;
  C.tick(s);
  s.career.jobs = [
    { id: 'A', tpl: 'x', title: 'a', metric: 'sold', target: 99, base: 0, endsDay: 1, reward: 1, xp: 1, done: false },
    { id: 'B', tpl: 'y', title: 'b', metric: 'sold', target: 1, base: 0, endsDay: 1, reward: 1, xp: 1, done: true },
  ];
  E.advance(s, 30);
  C.tick(s);
  assert.ok(!s.career.jobs.some((j) => j.id === 'A'));
  assert.ok(s.career.jobs.some((j) => j.id === 'B'));
});

test('badges unlock once and pay their reward', () => {
  const s = fresh(); s.cash = 50000;
  miningSetup(s);
  const out = C.tick(s);
  assert.ok(out.achievements.some((a) => a.id === 'first'));
  const again = C.tick(s);
  assert.ok(!again.achievements.some((a) => a.id === 'first'));
});

test('events arrive, wait for a choice and apply it', () => {
  const s = fresh(); s.cash = 50000;
  miningSetup(s);
  C.tick(s);
  let seen = false;
  for (let d = 0; d < 20 && !seen; d++) { E.advance(s, 24); C.tick(s); seen = !!s.career.event; }
  assert.ok(seen, 'an event should turn up within 20 days');
  const view = C.eventView(s);
  assert.ok(view.title && view.choices.length >= 1);
  const res = C.resolveEvent(s, view.choices.length - 1);
  assert.ok(res.ok, res.error);
  assert.equal(s.career.event, null);
  assert.equal(s.career.eventsDone, 1);
});

test('every event can be rolled and resolved both ways', () => {
  for (const def of C.EVENTS) {
    for (let choice = 0; choice < 2; choice++) {
      const s = fresh(); s.cash = 50000;
      miningSetup(s);
      C.tick(s);
      const room = E.roomStats(s);
      if (!def.weight(s, room)) continue;
      const ctx = def.roll(s, room);
      if (!ctx) continue;
      s.career.event = { id: def.id, ctx, day: s.day };
      const view = C.eventView(s);
      if (choice >= view.choices.length) continue;
      const res = C.resolveEvent(s, choice);
      assert.ok(res.ok, `${def.id} choice ${choice}: ${res.error}`);
      assert.ok(Number.isFinite(s.cash));
    }
  }
});

test('a pool promo boosts earnings while it lasts', () => {
  const s = fresh(); s.cash = 50000;
  miningSetup(s);
  const base = E.roomStats(s).grossPerDay;
  s.buffs.push({ kind: 'hash', mult: 1.08, untilDay: s.day + 2, label: 't' });
  assert.ok(Math.abs(E.roomStats(s).grossPerDay / base - 1.08) < 0.01);
  E.advance(s, 24 * 3);
  C.tick(s);
  assert.equal(s.buffs.length, 0);
});

test('daily streak grows on consecutive days and resets after a gap', () => {
  const s = fresh();
  assert.ok(C.claimDaily(s, '2026-11-10').ok);
  assert.ok(!C.claimDaily(s, '2026-11-10').ok);
  assert.equal(C.claimDaily(s, '2026-11-11').count, 2);
  assert.equal(C.claimDaily(s, '2026-11-14').count, 1);
  assert.equal(s.career.streak.best, 2);
});

test('level and badges survive a Hard Fork', () => {
  const s = fresh(); s.cash = 1e8;
  C.tick(s);
  C.grantXp(s, 5000);
  const level = s.career.level;
  const res = E.hardFork(s);
  assert.ok(res.ok);
  assert.equal(res.state.career.level, level);
  assert.deepEqual(res.state.career.jobs, []);
});

test('career state survives a save round-trip', () => {
  const s = fresh(); s.cash = 50000;
  miningSetup(s);
  C.tick(s);
  const back = E.deserialize(E.serialize(s));
  assert.deepEqual(back.career, s.career);
});
