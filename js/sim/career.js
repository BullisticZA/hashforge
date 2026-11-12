// Career layer on top of the engine: levels and ranks, badges, a contract board,
// random events with choices and a daily login streak. Deterministic (uses the engine RNG),
// except the streak, which the UI feeds with the real date.

import { byId, GPUS, ASICS, LOCATIONS } from '../data/catalog.js';
import * as E from './engine.js';

// ------------------------------------------------------------------ levels

export const RANKS = [
  [1, 'Bedroom Miner'], [4, 'Garage Tinkerer'], [8, 'Hash Hustler'], [12, 'Rig Wrangler'], [17, 'Rack Baron'],
  [23, 'Grid Warlord'], [30, 'Server Sultan'], [40, 'Hash Tycoon'], [55, 'Forge Legend'], [75, 'Satoshi\'s Heir'],
];
export const xpToNext = (level) => Math.round(60 * level ** 1.55);
export const rankOf = (level) => [...RANKS].reverse().find(([l]) => level >= l)[1];
export const nextRank = (level) => RANKS.find(([l]) => l > level) || null;
export const levelReward = (level) => Math.round(6 * level ** 1.3);
export const jobSlots = (level) => Math.min(6, 3 + Math.floor(level / 10));

const earned = (s) => (s.stats.minedUsd || 0) + (s.stats.hostingUsd || 0);

export function newCareer(state) {
  return {
    xp: 0, level: 1, totalXp: 0,
    achievements: {}, jobs: [], jobsDone: 0, eventsDone: 0, event: null,
    nextEventDay: Math.floor(state.day) + 2, lastDay: Math.floor(state.day), lastEarned: earned(state),
    streak: { count: 0, last: null, best: 0 },
  };
}

export function ensure(state) {
  if (!state.career) state.career = newCareer(state);
  if (!state.buffs) state.buffs = [];
  for (const k of ['bought', 'sold', 'repaired', 'signed', 'onlineHours']) state.stats[k] = state.stats[k] || 0;
  return state.career;
}

/** Add XP and pay out any level-ups. Returns the levels reached. */
export function grantXp(state, amount) {
  const c = ensure(state);
  c.xp += amount; c.totalXp += amount;
  const ups = [];
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    const reward = levelReward(c.level);
    state.cash += reward;
    const rank = RANKS.find(([l]) => l === c.level);
    E.addLog(state, 'milestone', `Level ${c.level}${rank ? `: you are now a ${rank[1]}` : ''}! Bonus {{usd:${reward}}}.`);
    ups.push({ level: c.level, reward, rank: rank?.[1] || null });
  }
  return ups;
}

// ------------------------------------------------------------------ achievements

const ownedGpus = (s) => [...s.rigs.flatMap((r) => r.gpus), ...s.inventory.filter((o) => byId[o.id]?.kind === 'gpu')];
const asicCount = (s) => s.racks.reduce((t, r) => t + r.asics.length, 0);
const locIndex = (s) => LOCATIONS.findIndex((l) => l.id === s.location);

export const ACHIEVEMENTS = [
  { id: 'first', icon: '⛏️', name: 'First Block', desc: 'Get a rig mining.', reward: 30, check: (s, r) => r.rigs.some((x) => x.running) },
  { id: 'fullhouse', icon: '🃏', name: 'Full House', desc: 'Fill every GPU slot in a rig.', reward: 80, check: (s) => s.rigs.some((x) => x.gpus.length >= byId[x.frameId].slots) },
  { id: 'farm', icon: '🌾', name: 'Rig Farm', desc: 'Own 4 mining rigs.', reward: 250, check: (s) => s.rigs.length >= 4 },
  { id: 'gpu12', icon: '🎴', name: 'Card Collector', desc: 'Own 12 graphics cards.', reward: 200, check: (s) => ownedGpus(s).length >= 12 },
  { id: 'asic', icon: '🧱', name: 'Big Iron', desc: 'Run an ASIC miner.', reward: 120, check: (s, r) => r.racks.some((x) => x.miners.some((m) => m.running)) },
  { id: 'asic10', icon: '🏗️', name: 'Rack \'em Up', desc: 'Own 10 ASIC miners.', reward: 900, check: (s) => asicCount(s) >= 10 },
  { id: 'junk', icon: '🗑️', name: 'Dumpster Diver', desc: 'Open 10 junkyard lots.', reward: 120, check: (s) => s.stats.lotsOpened >= 10 },
  { id: 'craft', icon: '🧪', name: 'Frankencard', desc: 'Build 5 cards on the Workbench.', reward: 200, check: (s) => s.stats.crafted >= 5 },
  { id: 'golden', icon: '🌟', name: 'Golden Touch', desc: 'Find or build a golden sample.', reward: 150, check: (s) => s.stats.goldens >= 1 },
  { id: 'flipper', icon: '💱', name: 'The Flipper', desc: 'Sell 15 items.', reward: 120, check: (s) => s.stats.sold >= 15 },
  { id: 'medic', icon: '🩺', name: 'Hardware Medic', desc: 'Repair 10 items.', reward: 150, check: (s) => s.stats.repaired >= 10 },
  { id: 'server', icon: '🖥️', name: 'Sysadmin', desc: 'Run 3 servers, PCs or NAS boxes.', reward: 250, check: (s, r) => (r.servers || []).filter((x) => x.running).length >= 3 },
  { id: 'clients5', icon: '🤝', name: 'Client Magnet', desc: 'Host 5 clients at once.', reward: 400, check: (s) => (s.clients || []).length >= 5 },
  { id: 'rep50', icon: '🏅', name: 'Five Nines', desc: 'Reach reputation 50.', reward: 800, check: (s) => (s.reputation || 0) >= 50 },
  { id: 'ups', icon: '🔋', name: 'Never Blink', desc: 'Own a UPS.', reward: 60, check: (s) => (s.energy.ups || []).length > 0 },
  { id: 'solar', icon: '☀️', name: 'Sun King', desc: 'Install 10 kWp of solar.', reward: 600, check: (s) => E.energyCapacity(s).solarKwp >= 10 },
  { id: 'offgrid', icon: '🛡️', name: 'Shed Proof', desc: 'Keep mining during Stage 4 load-shedding or worse.', reward: 300, check: (s, r) => s.grid.stage >= 4 && !r.offline && r.grossPerDay > 0 },
  { id: 'p10', icon: '💵', name: 'Side Hustle', desc: 'Make {{usd:10}} a day after power.', reward: 100, check: (s, r) => E.profitPerDay(s, r) >= 10 },
  { id: 'p50', icon: '💰', name: 'Day Job Who?', desc: 'Make {{usd:50}} a day after power.', reward: 500, check: (s, r) => E.profitPerDay(s, r) >= 50 },
  { id: 'p250', icon: '🏦', name: 'Money Printer', desc: 'Make {{usd:250}} a day after power.', reward: 2500, check: (s, r) => E.profitPerDay(s, r) >= 250 },
  { id: 'p1000', icon: '🚀', name: 'To the Moon', desc: 'Make {{usd:1000}} a day after power.', reward: 10000, check: (s, r) => E.profitPerDay(s, r) >= 1000 },
  { id: 'w10k', icon: '📈', name: 'Five Figures', desc: 'Reach a net worth of {{usd:10000}}.', reward: 300, check: (s) => E.netWorth(s) >= 10000 },
  { id: 'w100k', icon: '💎', name: 'Six Figures', desc: 'Reach a net worth of {{usd:100000}}.', reward: 3000, check: (s) => E.netWorth(s) >= 100000 },
  { id: 'w1m', icon: '👑', name: 'Millionaire', desc: 'Reach a net worth of {{usd:1000000}}.', reward: 30000, check: (s) => E.netWorth(s) >= 1000000 },
  { id: 'garage', icon: '🚪', name: 'Moving Out', desc: 'Move out of the bedroom.', reward: 200, check: (s) => locIndex(s) >= 1 },
  { id: 'warehouse', icon: '🏭', name: 'Industrial', desc: 'Move into the third location.', reward: 1500, check: (s) => locIndex(s) >= 2 },
  { id: 'datacenter', icon: '🌐', name: 'Datacentre', desc: 'Reach the top location.', reward: 8000, check: (s) => locIndex(s) >= LOCATIONS.length - 1 },
  { id: 'jobs10', icon: '📋', name: 'Contractor', desc: 'Complete 10 contracts.', reward: 120, check: (s) => s.career.jobsDone >= 10 },
  { id: 'jobs50', icon: '🗂️', name: 'Reliable Pro', desc: 'Complete 50 contracts.', reward: 600, check: (s) => s.career.jobsDone >= 50 },
  { id: 'events10', icon: '🎲', name: 'Street Smart', desc: 'Handle 10 events.', reward: 120, check: (s) => s.career.eventsDone >= 10 },
  { id: 'streak7', icon: '🔥', name: 'On Fire', desc: 'Play 7 days in a row.', reward: 500, check: (s) => (s.career.streak?.best || 0) >= 7 },
  { id: 'lvl10', icon: '⭐', name: 'Double Digits', desc: 'Reach level 10.', reward: 200, check: (s) => s.career.level >= 10 },
  { id: 'lvl25', icon: '🌠', name: 'Veteran', desc: 'Reach level 25.', reward: 1000, check: (s) => s.career.level >= 25 },
  { id: 'year', icon: '📅', name: 'Survivor', desc: 'Keep the lights on for a year.', reward: 1000, check: (s) => s.day >= 365 },
  { id: 'fork', icon: '🔱', name: 'Hard Forker', desc: 'Complete a Hard Fork.', reward: 0, check: (s) => s.prestige.forks >= 1 },
];

// ------------------------------------------------------------------ contracts

const METRICS = {
  mined: (s) => s.stats.minedUsd, hosted: (s) => s.stats.hostingUsd || 0, crafted: (s) => s.stats.crafted,
  lots: (s) => s.stats.lotsOpened, bought: (s) => s.stats.bought, sold: (s) => s.stats.sold, repaired: (s) => s.stats.repaired,
  signed: (s) => s.stats.signed, online: (s) => s.stats.onlineHours,
  profit: (s, r) => E.profitPerDay(s, r), rep: (s) => s.reputation || 0,
};
const DELTA = new Set(['mined', 'hosted', 'crafted', 'lots', 'bought', 'sold', 'repaired', 'signed', 'online']);
const nice = (x) => (x < 10 ? Math.ceil(x * 10) / 10 : x < 100 ? Math.ceil(x) : Math.ceil(x / 5) * 5);
const brokenOrWorn = (s) => E.allOwned(s).some((o) => o.broken || (o.cond !== undefined && o.cond < 0.9));

const JOBS = [
  { id: 'mine', weight: (s, r) => (r.grossPerDay > 0.2 ? 4 : 0), make: (s, r, rnd) => {
    const days = 2 + Math.floor(rnd() * 3); const target = nice(r.grossPerDay * days * 0.7);
    return { title: `Mine {{usd:${target}}} in ${days} days`, metric: 'mined', target, days, diff: 1 + target / (r.grossPerDay * days) };
  } },
  { id: 'host', weight: (s) => ((s.clients || []).length ? 3 : 0), make: (s, r, rnd) => {
    const days = 3 + Math.floor(rnd() * 3); const target = nice(E.hostingPerDay(s) * days * 0.85);
    return { title: `Earn {{usd:${target}}} from hosting in ${days} days`, metric: 'hosted', target, days, diff: 1.2 };
  } },
  { id: 'uptime', weight: (s, r) => (r.grossPerDay > 0 ? 2 : 0), make: (s, r, rnd) => {
    const days = 3; const target = 48 + Math.floor(rnd() * 3) * 6;
    return { title: `Keep miners earning for ${target} hours in ${days} days`, metric: 'online', target, days, diff: 1.3 + (target - 48) / 40 };
  } },
  { id: 'junk', weight: () => 2, make: (s, r, rnd) => {
    const n = 1 + Math.floor(rnd() * 3);
    return { title: `Open ${n} junkyard lot${n > 1 ? 's' : ''}`, metric: 'lots', target: n, days: 3, diff: 0.8 + n * 0.3 };
  } },
  { id: 'craft', weight: (s) => (s.stats.lotsOpened > 0 ? 1.5 : 0), make: () => ({ title: 'Build a card on the Workbench', metric: 'crafted', target: 1, days: 4, diff: 1.6 }) },
  { id: 'buy', weight: () => 2, make: (s, r, rnd) => {
    const n = 2 + Math.floor(rnd() * 3);
    return { title: `Buy ${n} pieces of hardware`, metric: 'bought', target: n, days: 3, diff: 0.7 + n * 0.15 };
  } },
  { id: 'sell', weight: (s) => (E.allOwned(s).length > 3 ? 1.5 : 0), make: (s, r, rnd) => {
    const n = 2 + Math.floor(rnd() * 2);
    return { title: `Sell ${n} items you don't need`, metric: 'sold', target: n, days: 3, diff: 0.8 };
  } },
  { id: 'repair', weight: (s) => (brokenOrWorn(s) ? 2 : 0), make: () => ({ title: 'Repair a worn or broken item', metric: 'repaired', target: 1, days: 3, diff: 0.9 }) },
  { id: 'profit', weight: (s, r) => (s.rigs.length || s.racks.length ? 2.5 : 0), make: (s, r, rnd) => {
    const now = Math.max(0, E.profitPerDay(s, r)); const target = nice(Math.max(1, now * (1.12 + rnd() * 0.15) + 0.5));
    return { title: `Reach {{usd:${target}}} a day profit`, metric: 'profit', target, days: 5, diff: 1.8 };
  } },
  { id: 'sign', weight: (s) => ((s.servers || []).length ? 2 : 0), make: () => ({ title: 'Sign a new hosting client', metric: 'signed', target: 1, days: 4, diff: 1.3 }) },
  { id: 'rep', weight: (s) => ((s.clients || []).length ? 1.5 : 0), make: (s) => {
    const target = Math.floor(s.reputation || 0) + 3;
    return { title: `Reach reputation ${target}`, metric: 'rep', target, days: 6, diff: 1.5 };
  } },
];

function pickWeighted(state, list, weightOf) {
  const w = list.map(weightOf); const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let roll = E.rng(state) * total;
  for (let i = 0; i < list.length; i++) { roll -= w[i]; if (roll <= 0) return list[i]; }
  return list[list.length - 1];
}

export function makeJob(state, room) {
  const c = state.career;
  const taken = new Set(c.jobs.map((j) => j.tpl));
  const tpl = pickWeighted(state, JOBS, (t) => (taken.has(t.id) ? 0 : t.weight(state, room)));
  if (!tpl) return null;
  const j = tpl.make(state, room, () => E.rng(state));
  // Pay scales with the size of the operation (about a day's income), not with level, so it never runs away.
  const econ = room.grossPerDay + E.hostingPerDay(state);
  const reward = Math.round(Math.max(8 + c.level, econ * 1.1) * j.diff);
  const xp = Math.round(xpToNext(c.level) * 0.09 * j.diff);
  return {
    id: `J${state.nextUid++}`, tpl: tpl.id, title: j.title, metric: j.metric, target: j.target,
    base: DELTA.has(j.metric) ? METRICS[j.metric](state, room) : 0,
    endsDay: Math.floor(state.day) + j.days, reward, xp, done: false,
  };
}

export function jobProgress(state, job, room) {
  const v = METRICS[job.metric](state, room);
  const p = DELTA.has(job.metric) ? v - job.base : v;
  return Math.max(0, Math.min(1, p / job.target));
}

export function claimJob(state, jobId) {
  const c = ensure(state);
  const i = c.jobs.findIndex((j) => j.id === jobId);
  if (i === -1) return { ok: false, error: 'That contract is gone.' };
  const job = c.jobs[i];
  if (!job.done) return { ok: false, error: 'Not finished yet.' };
  c.jobs.splice(i, 1);
  c.jobsDone += 1;
  state.cash += job.reward;
  E.addLog(state, 'milestone', `Contract done: ${job.title}. Paid {{usd:${job.reward}}}.`);
  return { ok: true, job, levelUps: grantXp(state, job.xp) };
}

export function dropJob(state, jobId) {
  const c = ensure(state);
  c.jobs = c.jobs.filter((j) => j.id !== jobId || j.done);
  return { ok: true };
}

// ------------------------------------------------------------------ events

const randomGpu = (state, maxPrice) => {
  const pool = GPUS.filter((g) => g.price <= maxPrice && g.price >= 60);
  return pool.length ? pool[Math.floor(E.rng(state) * pool.length)] : null;
};
const workingMiners = (s) => [...s.rigs.flatMap((r) => r.gpus), ...s.racks.flatMap((r) => r.asics)].filter((o) => !o.broken);
const scale = (s) => 1 + s.career.level * 0.15;

/** Buy something at a discount through the normal shop path (so placement rules still apply). */
function buyAt(state, itemId, price) {
  const full = E.buyPrice(state, byId[itemId]);
  if (state.cash < price) return { ok: false, error: 'Not enough cash.' };
  state.cash += full - price;
  const res = E.buy(state, itemId);
  if (!res.ok) state.cash -= full - price;
  return res;
}
const addBuff = (state, kind, mult, days, label) => state.buffs.push({ kind, mult, untilDay: state.day + days, label });

export const EVENTS = [
  { id: 'neighbour', icon: '🏘️', weight: (s) => (s.cash > 80 ? 3 : 0),
    roll: (s) => { const g = randomGpu(s, Math.max(150, s.cash * 0.5)); return g && { item: g.id, price: Math.round(E.buyPrice(s, g) * (0.45 + E.rng(s) * 0.15)) }; },
    title: (s, x) => `Your neighbour is selling a ${byId[x.item].name}`,
    text: (s, x) => `Barely used, he says. Brand new it's {{usd:${E.buyPrice(s, byId[x.item])}}}. He wants {{usd:${x.price}}} cash, today only.`,
    choices: (s, x) => [
      { label: `Buy it for {{usd:${x.price}}}`, cost: x.price, apply: (st) => { const r = buyAt(st, x.item, x.price); return r.ok ? { text: `Got the ${byId[x.item].name} for a steal.`, uid: r.uid } : { error: r.error }; } },
      { label: 'No thanks', apply: () => ({ text: 'You let it go.' }) },
    ] },
  { id: 'storm', icon: '⛈️', weight: (s) => (workingMiners(s).length ? 2 : 0),
    roll: (s) => ({ cost: Math.round(15 + 4 * workingMiners(s).length * scale(s)) }),
    title: () => 'Lightning storm warning', text: () => 'A big storm is rolling in tonight. Power surges fry hardware.',
    choices: (s, x) => [
      { label: `Fit surge protection ({{usd:${x.cost}}})`, cost: x.cost, apply: (st) => { st.cash -= x.cost; return { text: 'The storm hit, but your gear came through fine.' }; } },
      { label: 'Risk it', apply: (st) => {
        if (E.rng(st) < 0.35) {
          const list = workingMiners(st); const o = list[Math.floor(E.rng(st) * list.length)];
          if (o) { o.broken = true; return { text: `A surge fried your ${byId[o.id].name}. Repair it or salvage it.`, bad: true }; }
        }
        return { text: 'Lucky! The storm passed without damage.' };
      } },
    ] },
  { id: 'pool', icon: '🏊', weight: (s, r) => (r.grossPerDay > 0 ? 2 : 0),
    roll: (s, r) => ({ cost: Math.round(5 + r.grossPerDay * 1.5), days: 7 }),
    title: () => 'Mining pool promo: zero fees', text: (s, x) => `A new pool is waiving fees for ${x.days} days. Switching takes some config time.`,
    choices: (s, x) => [
      { label: `Switch pools ({{usd:${x.cost}}}): +8% earnings for ${x.days} days`, cost: x.cost, apply: (st) => { st.cash -= x.cost; addBuff(st, 'hash', 1.08, x.days, 'Pool promo +8%'); return { text: 'Switched pools: +8% earnings this week.' }; } },
      { label: 'Stay put', apply: () => ({ text: 'You stuck with your pool.' }) },
    ] },
  { id: 'tariff', icon: '📄', weight: (s, r) => (r.demandWatts > 300 ? 2 : 0),
    roll: (s, r) => ({ cost: Math.round(r.demandWatts / 1000 * 24 * E.tariffUsd(s) * 30 * 0.12) + 5 }),
    title: () => 'Fixed-rate power deal', text: () => 'An energy broker offers a 30-day contract at 20% below your tariff, for an upfront fee.',
    choices: (s, x) => [
      { label: `Sign ({{usd:${x.cost}}}): power 20% cheaper for 30 days`, cost: x.cost, apply: (st) => { st.cash -= x.cost; addBuff(st, 'tariff', 0.8, 30, 'Fixed-rate deal −20%'); return { text: 'Signed. Power is 20% cheaper for a month.' }; } },
      { label: 'Not interested', apply: () => ({ text: 'You passed on the deal.' }) },
    ] },
  { id: 'gig', icon: '🧰', weight: () => 3,
    roll: (s) => {
      const gigs = ['fix a friend\'s gaming PC', 'set up Wi-Fi for the corner café', 'recover photos from a dead laptop', 'build a PC for a streamer', 'network the church hall', 'clean viruses off granny\'s PC', 'install CCTV at a spaza shop'];
      return { what: gigs[Math.floor(E.rng(s) * gigs.length)], pay: Math.round((20 + E.rng(s) * 40) * scale(s)) };
    },
    title: (s, x) => `Side job: ${x.what}`, text: (s, x) => `Someone wants you to ${x.what}. Pays {{usd:${x.pay}}} plus experience.`,
    choices: (s, x) => [
      { label: `Take the job (+{{usd:${x.pay}}})`, apply: (st) => { st.cash += x.pay; return { text: `Job done: +{{usd:${x.pay}}}.`, xp: Math.round(xpToNext(st.career.level) * 0.12) }; } },
      { label: 'Too busy', apply: () => ({ text: 'You turned the job down.' }) },
    ] },
  { id: 'meme', icon: '🐸', weight: (s) => (s.cash > 100 ? 1.5 : 0),
    roll: (s) => ({ stake: Math.max(10, Math.round(s.cash * 0.05)) }),
    title: () => 'A mate is shilling a meme coin', text: () => '"FrogCoin is going to the moon, bru." It could triple. It could also go to zero.',
    choices: (s, x) => [
      { label: `Gamble {{usd:${x.stake}}}`, cost: x.stake, apply: (st) => {
        if (E.rng(st) < 0.38) { st.cash += x.stake * 2; return { text: `FrogCoin pumped! You tripled your money: +{{usd:${x.stake * 2}}}.` }; }
        st.cash -= x.stake; return { text: `FrogCoin rugged. You lost {{usd:${x.stake}}}.`, bad: true };
      } },
      { label: 'Hard pass', apply: () => ({ text: 'You kept your money.' }) },
    ] },
  { id: 'heat', icon: '🌡️', weight: (s, r) => (s.mods.ambient === 0 && r.minerWatts > 0 ? 1.5 : 0),
    roll: (s, r) => ({ cost: Math.round(10 + r.minerWatts / 100) }),
    title: () => 'Heatwave forecast', text: () => 'The weather service warns of a brutal heatwave next week. Hot rooms throttle and wear hardware.',
    choices: (s, x) => [
      { label: `Buy extra fans and ice packs ({{usd:${x.cost}}})`, cost: x.cost, apply: (st) => { st.cash -= x.cost; st.mods.ambient = 3; st.mods.ambientDaysLeft = 5; return { text: 'Prepared: the heatwave only adds +3 °C.' }; } },
      { label: 'Ride it out', apply: (st) => { st.mods.ambient = 9; st.mods.ambientDaysLeft = 5; return { text: 'Heatwave! +9 °C for 5 days.', bad: true }; } },
    ] },
  { id: 'cable', icon: '🔌', weight: (s, r) => (r.demandWatts > 0 ? 1.5 : 0),
    roll: (s) => ({ cost: Math.round(12 * scale(s)) }),
    title: () => 'Cable thieves in the area', text: () => 'Copper thieves hit the substation down the road last night. Yours might be next.',
    choices: (s, x) => [
      { label: `Chip in for armed response ({{usd:${x.cost}}})`, cost: x.cost, apply: (st) => { st.cash -= x.cost; return { text: 'Security patrols kept the cables safe.' }; } },
      { label: 'Ignore it', apply: (st) => {
        if (E.rng(st) < 0.5) { st.grid.outageHours = (st.grid.outageHours || 0) + 10; return { text: 'Thieves cut the cables: 10 hours without grid power.', bad: true }; }
        return { text: 'The thieves went elsewhere.' };
      } },
    ] },
  { id: 'refund', icon: '🧾', weight: (s) => (s.day > 20 ? 1 : 0),
    roll: (s) => ({ amount: Math.round((15 + E.rng(s) * 35) * scale(s)) }),
    title: () => 'Tax refund came through', text: (s, x) => `Surprise: {{usd:${x.amount}}} back from the taxman.`,
    choices: (s, x) => [{ label: `Collect {{usd:${x.amount}}}`, apply: (st) => { st.cash += x.amount; return { text: `+{{usd:${x.amount}}} tax refund.` }; } }] },
  { id: 'rival', icon: '🏳️', weight: (s) => (s.racks.some((r) => r.asics.length < byId[r.id].units) ? 1.5 : 0),
    roll: (s) => {
      const pool = ASICS.filter((a) => a.price <= Math.max(400, s.cash * 1.2));
      if (!pool.length) return null;
      const a = pool[Math.floor(E.rng(s) * pool.length)];
      return { item: a.id, price: Math.round(E.buyPrice(s, a) * 0.5) };
    },
    title: (s, x) => `A rival is quitting mining`, text: (s, x) => `They're dumping a ${byId[x.item].name} at half price: {{usd:${x.price}}}. It goes straight into your rack.`,
    choices: (s, x) => [
      { label: `Buy it for {{usd:${x.price}}}`, cost: x.price, apply: (st) => { const r = buyAt(st, x.item, x.price); return r.ok ? { text: `Bought the ${byId[x.item].name} at half price.`, uid: r.uid } : { error: r.error }; } },
      { label: 'Let it go', apply: () => ({ text: 'Someone else snapped it up.' }) },
    ] },
  { id: 'blog', icon: '📸', weight: (s) => (s.rigs.length + (s.servers || []).length >= 2 ? 1.5 : 0),
    roll: () => ({}),
    title: () => 'A tech blog wants to feature you', text: () => 'They want photos of your setup. Good publicity, but it takes a day of tidying.',
    choices: () => [
      { label: 'Give them the tour', apply: (st) => { st.reputation = (st.reputation || 0) + 3; st.dust = Math.max(0, (st.dust || 0) - 0.2); return { text: 'Featured! Reputation +3, and the room got a clean.', xp: Math.round(xpToNext(st.career.level) * 0.1) }; } },
      { label: 'Decline', apply: () => ({ text: 'You stayed low-key.' }) },
    ] },
  { id: 'cat', icon: '🐈', weight: (s) => (s.rigs.some((r) => r.gpus.length) ? 1.2 : 0),
    roll: () => ({ cost: 8 }),
    title: () => 'The cat discovered the mining rig', text: () => 'It\'s warm, it hums, and she loves sleeping on it. Fur in the fans is bad news.',
    choices: (s, x) => [
      { label: `Buy a mesh guard ({{usd:${x.cost}}})`, cost: x.cost, apply: (st) => { st.cash -= x.cost; return { text: 'Cat-proofed. She found a sunny spot instead.' }; } },
      { label: 'She\'ll be fine', apply: (st) => {
        if (E.rng(st) < 0.45) { st.dust = Math.min(1, (st.dust || 0) + 0.25); return { text: 'Cat fur everywhere: dust +25%. Clean the room.', bad: true }; }
        return { text: 'She got bored and left. Phew.' };
      } },
    ] },
  { id: 'sale', icon: '🏷️', weight: () => 1.2, roll: () => ({}),
    title: () => 'Vendor flash sale', text: () => 'Every vendor is 15% off for the next 3 days.',
    choices: () => [{ label: 'Nice, let\'s shop', apply: (st) => { addBuff(st, 'price', 0.85, 3, 'Flash sale −15%'); return { text: 'Flash sale: 15% off for 3 days.' }; } }] },
  { id: 'lan', icon: '🎮', weight: (s) => (s.day > 10 ? 1 : 0),
    roll: (s) => ({ pay: Math.round((25 + E.rng(s) * 30) * scale(s)) }),
    title: () => 'LAN party next door', text: (s, x) => `The gamers next door need power and Wi-Fi for the weekend. They'll pay {{usd:${x.pay}}}, but it gets dusty.`,
    choices: (s, x) => [
      { label: `Host them (+{{usd:${x.pay}}}, dust +15%)`, apply: (st) => { st.cash += x.pay; st.dust = Math.min(1, (st.dust || 0) + 0.15); return { text: `LAN party paid {{usd:${x.pay}}}.` }; } },
      { label: 'Say no', apply: () => ({ text: 'Quiet weekend.' }) },
    ] },
];

function rollEvent(state, room) {
  const def = pickWeighted(state, EVENTS, (e) => e.weight(state, room));
  if (!def) return null;
  const ctx = def.roll(state, room);
  return ctx ? { id: def.id, ctx, day: state.day } : null;
}

/** The pending event, ready to show: title, text and choices with labels. */
export function eventView(state) {
  const ev = state.career?.event;
  if (!ev) return null;
  const def = EVENTS.find((e) => e.id === ev.id);
  if (!def) return null;
  return {
    icon: def.icon, title: def.title(state, ev.ctx), text: def.text(state, ev.ctx),
    choices: def.choices(state, ev.ctx).map((c, i) => ({ i, label: c.label, affordable: !c.cost || state.cash >= c.cost })),
  };
}

export function resolveEvent(state, choice) {
  const c = ensure(state);
  const ev = c.event;
  if (!ev) return { ok: false, error: 'Nothing to decide.' };
  const def = EVENTS.find((e) => e.id === ev.id);
  const ch = def.choices(state, ev.ctx)[choice];
  if (!ch) return { ok: false, error: 'Pick an option.' };
  if (ch.cost && state.cash < ch.cost) return { ok: false, error: 'Not enough cash for that.' };
  const out = ch.apply(state);
  if (out.error) return { ok: false, error: out.error };
  c.event = null;
  c.eventsDone += 1;
  c.nextEventDay = Math.floor(state.day) + 4 + Math.floor(E.rng(state) * 5);
  E.addLog(state, out.bad ? 'warning' : 'info', out.text);
  const levelUps = grantXp(state, (out.xp || 0) + Math.round(xpToNext(c.level) * 0.04));
  return { ok: true, ...out, levelUps };
}

// ------------------------------------------------------------------ daily streak (real days)

const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export function dailyAvailable(state, today) {
  const st = ensure(state).streak;
  return st.last !== today;
}
export function dailyPreview(state, today) {
  const st = ensure(state).streak;
  const count = st.last && dayDiff(st.last, today) === 1 ? st.count + 1 : 1;
  const cash = Math.round((20 + 12 * Math.min(count, 14)) * (1 + state.career.level * 0.2));
  const xp = Math.round(xpToNext(state.career.level) * (0.1 + 0.02 * Math.min(count, 10)));
  return { count, cash, xp };
}
export function claimDaily(state, today) {
  const c = ensure(state);
  if (!dailyAvailable(state, today)) return { ok: false, error: 'Already claimed today. Come back tomorrow!' };
  const p = dailyPreview(state, today);
  c.streak.count = p.count; c.streak.last = today; c.streak.best = Math.max(c.streak.best || 0, p.count);
  state.cash += p.cash;
  E.addLog(state, 'milestone', `Daily bonus, day ${p.count} streak: {{usd:${p.cash}}}.`);
  return { ok: true, ...p, levelUps: grantXp(state, p.xp) };
}

// ------------------------------------------------------------------ tick

/**
 * Call often (the UI does it a few times a second). Grants XP for earnings, rolls the contract
 * board and events on new days, finishes contracts and awards badges. Returns what happened so the
 * UI can celebrate it.
 */
export function tick(state, room = E.roomStats(state)) {
  const c = ensure(state);
  const out = { levelUps: [], achievements: [], jobs: [], event: null };
  const now = earned(state);
  if (now > c.lastEarned) out.levelUps.push(...grantXp(state, Math.round((now - c.lastEarned) * 4 * 100) / 100));
  c.lastEarned = now;
  state.buffs = state.buffs.filter((b) => b.untilDay > state.day);

  for (const job of c.jobs) {
    if (!job.done && jobProgress(state, job, room) >= 1) { job.done = true; out.jobs.push(job); }
  }
  const today = Math.floor(state.day);
  let refill = !c.filled;
  if (c.lastDay < today) {
    c.lastDay = today;
    refill = true;
    c.jobs = c.jobs.filter((j) => j.done || j.endsDay > today);
    if (!c.event && today >= c.nextEventDay) { c.event = rollEvent(state, room); if (c.event) out.event = c.event; }
  }
  // New contracts arrive each morning (not straight after a claim, so the board can't be farmed).
  c.filled = true;
  for (let guard = 0; refill && c.jobs.length < jobSlots(c.level) && guard < 6; guard++) {
    const job = makeJob(state, room);
    if (!job) break;
    c.jobs.push(job);
  }
  for (const a of ACHIEVEMENTS) {
    if (c.achievements[a.id] !== undefined) continue;
    let hit = false;
    try { hit = a.check(state, room); } catch { hit = false; }
    if (!hit) continue;
    c.achievements[a.id] = state.day;
    state.cash += a.reward;
    E.addLog(state, 'milestone', `Badge unlocked: ${a.icon} ${a.name}${a.reward ? `. Reward {{usd:${a.reward}}}` : ''}.`);
    out.achievements.push(a);
    out.levelUps.push(...grantXp(state, Math.round(xpToNext(c.level) * 0.15)));
  }
  return out;
}
