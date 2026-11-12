// HashForge simulation engine. Pure logic - no DOM, no 3D - so every rule is tested in Node.
// Money is tracked in USD internally; the UI shows it in the player's currency.

import {
  ALGOS, GPU_ALGOS, GPUS, ASICS, PSUS, LOCATIONS, REGIONS, RISERS, OS, FACILITY, byId,
} from '../data/catalog.js';
import {
  QUALITY, QUALITY_ORDER, gradeAt, PART_TYPES, CRAFT_FEE, JUNK_LOTS, UPGRADES,
  upgradeCost, forkThreshold, forkReward, eraDifficulty,
} from '../data/progression.js';

export const DAY_HOURS = 24;
export const BILL_PERIOD_DAYS = 30;
export const SAVE_VERSION = 3;
const DEVICE_TEMP_OFFSET = 35;  // chips run this much hotter than the room
const THROTTLE_AT = 75;
const SHUTDOWN_AT = 95;
const HALVING_FIRST_DAY = 600;
const HALVING_EVERY_DAYS = 1460;
const DIESEL_USD_PER_LITRE = 1.3;
// Load-shedding: hours without power per day at each stage (in 2-hour blocks).
const SHED_BLOCKS = [0, 1, 2, 2, 3, 3, 4, 5, 6];
const SHED_BLOCK_STARTS = [6, 14, 22, 2, 10, 18];

// ------------------------------------------------------------------ random

export function rng(state) {
  let t = (state.seed += 0x6d2b79f5) >>> 0;   // mulberry32: seeded and saved, so runs replay identically
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gaussian(state) {
  const u = Math.max(rng(state), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng(state));
}
const pick = (state, list) => list[Math.floor(rng(state) * list.length)];
function weighted(state, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng(state) * total;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) return i; }
  return weights.length - 1;
}

// ------------------------------------------------------------------ setup

export function newPrestige() {
  return { forks: 0, shards: 0, lifetimeShards: 0, upgrades: {}, bestNetWorth: 0 };
}

export function newGame(seed = Date.now() % 2147483647, options = {}) {
  const prestige = options.prestige || newPrestige();
  const region = REGIONS.find((r) => r.id === (options.region || 'za')) || REGIONS[0];
  const index = {}; const difficulty = {}; const history = {};
  for (const a of Object.keys(ALGOS)) {
    index[a] = 1.6;
    difficulty[a] = eraDifficulty(prestige.forks);
    history[a] = [1.6];
  }
  const state = {
    version: SAVE_VERSION,
    seed, hours: 0, day: 0, carry: 0,
    cash: 2500 + 2500 * (prestige.upgrades.capital || 0),
    region: region.id,
    tariffLocal: options.tariffLocal ?? region.tariff,
    fx: options.fx ?? region.fx,
    location: 'bedroom',
    nextUid: 1,
    inventory: [], parts: [], rigs: [], racks: [], cooling: [],
    energy: { solar: [], inverters: [], batteries: [], generators: [], gridCharge: true },
    grid: { stage: 0, stageDaysLeft: 3, outageHours: 0, breakerTripped: false, offline: false, offlineReason: '' },
    market: { index, difficulty, history, regime: 'bull', regimeDaysLeft: 45, halvings: 0 },
    listings: [],
    weather: 1,
    dust: 0,
    facility: {},
    tariffPlan: 'standard',
    lastDeviceTemp: 40,
    mods: { gpuPrice: 1, asicPrice: 1, ambient: 0, ambientDaysLeft: 0 },
    power: { gridKwh: 0, gridCost: 0, dieselCost: 0, lastBillDay: 0 },
    stats: { minedUsd: 0, powerPaid: 0, bestDay: 0, earnedToday: 0, costToday: 0, crafted: 0, lotsOpened: 0, goldens: 0 },
    goals: { done: [], tier: 0 },
    log: [],
    prestige,
    gameOver: false,
  };
  refreshListings(state, true);
  addLog(state, 'info', prestige.forks
    ? `Hard Fork #${prestige.forks}: a new era begins. The network is ${Math.round((eraDifficulty(prestige.forks) - 1) * 100)}% harder, but your upgrades carry over.`
    : 'Welcome to HashForge. Buy a rig kit, a PSU and a GPU, or try your luck at the junkyard.');
  return state;
}

const newUid = (state) => `u${state.nextUid++}`;
export const location = (state) => LOCATIONS.find((l) => l.id === state.location);
export const region = (state) => REGIONS.find((r) => r.id === state.region);

function addLog(state, type, text) {
  const top = state.log[0];
  // The same message again (an outage every day, say) bumps a counter instead of flooding the log.
  if (top && top.type === type && top.text === text) { top.count = (top.count || 1) + 1; top.day = state.day; return; }
  state.log.unshift({ day: state.day, type, text });
  if (state.log.length > 100) state.log.length = 100;
}
const fail = (error) => ({ ok: false, error });

// ------------------------------------------------------------------ prestige effects

export function effects(state) {
  const L = (id) => state.prestige.upgrades[id] || 0;
  return {
    hash: 1 + 0.03 * L('firmware'),
    tariff: Math.max(0.35, 0.96 ** L('contracts')),
    price: Math.max(0.4, 0.97 ** L('haggler')),
    scavenger: L('scavenger'),
    builder: L('builder'),
    cooling: 1 + 0.06 * L('thermal'),
    wear: 0.92 ** L('durable'),
  };
}

// ------------------------------------------------------------------ money

/** Electricity price in USD per kWh at the current location. */
export function tariffUsd(state) {
  return (state.tariffLocal / state.fx) * location(state).tariffMult * effects(state).tariff;
}
/**
 * Daytime-surplus plan (South Africa): cheap while rooftop solar floods the grid (06:00-17:59),
 * pricier at night. Inspired by Eskom's 2026 talk of selling surplus daytime power to miners.
 */
export function tariffHourMult(state, hour = state.hours % DAY_HOURS) {
  if (state.tariffPlan !== 'daytime') return 1;
  return hour >= 6 && hour < 18 ? 0.55 : 1.2;
}
export function setTariffPlan(state, plan) {
  if (!['standard', 'daytime'].includes(plan)) return fail('Unknown plan');
  if (plan === 'daytime' && state.region !== 'za') return fail('The daytime surplus plan is only offered in South Africa.');
  state.tariffPlan = plan;
  addLog(state, 'info', plan === 'daytime' ? 'Switched to the daytime surplus tariff: cheap by day, pricier at night.' : 'Switched to the standard tariff.');
  return { ok: true };
}
export function halvingFactor(state, algo) {
  return algo === 'sha256' ? 0.5 ** state.market.halvings : 1;
}
/** USD per day earned by one unit of hashrate (1 MH/s, GH/s or TH/s) right now. */
export function revenuePerUnit(state, algo) {
  const m = state.market;
  return ALGOS[algo].revenuePerUnit * m.index[algo] / m.difficulty[algo] * halvingFactor(state, algo);
}
export function coinPrice(state, algo) {
  return ALGOS[algo].basePrice * state.market.index[algo];
}
export function buyPrice(state, item, grade = 'new') {
  let mod = 1;
  if (item.kind === 'gpu') mod = state.mods.gpuPrice;
  if (item.kind === 'asic') mod = state.mods.asicPrice;
  return Math.round(item.price * mod * effects(state).price * QUALITY[grade].price);
}
export function sellValue(state, owned) {
  const item = byId[owned.id];
  const q = QUALITY[owned.q || 'new'];
  const age = Math.max(0, state.day - (owned.boughtDay ?? state.day));
  const wear = Math.max(0.3, 1 - age / 1500);
  const cond = owned.cond ?? 1;
  const broken = owned.broken ? 0.2 : 1;
  return Math.round(item.price * effects(state).price * 0.65 * q.price * (0.5 + 0.5 * cond) * wear * broken);
}
export function partValue(state, part) {
  const spec = byId[part.model];
  return Math.max(1, Math.round(spec.price * PART_TYPES[part.type].share * QUALITY[part.q].price * 0.5 * effects(state).price));
}

// ------------------------------------------------------------------ effective hardware stats

function condFactor(owned) {
  return 0.85 + 0.15 * (owned.cond ?? 1);
}
export function gpuEffective(state, owned) {
  const spec = byId[owned.id];
  const q = QUALITY[owned.q || 'new'];
  if (owned.broken) return { hash: { kawpow: 0, etchash: 0, autolykos: 0 }, power: 0 };
  const mods = owned.mods || {};
  // GDDR6X runs hot: stock pads let the memory throttle (~110 °C) until the card is re-padded.
  let thermal = spec.mem === 'GDDR6X' && !mods.pads ? 0.85 : 1;
  if (mods.shim) thermal *= 1.03;
  if (mods.paste) thermal *= 1.01;
  const m = q.perf * condFactor(owned) * effects(state).hash * thermal;
  return {
    hash: Object.fromEntries(GPU_ALGOS.map((a) => [a, spec.hash[a] * m])),
    power: spec.power * q.power,
    memThrottled: thermal < 1,
  };
}
export function asicEffective(state, owned) {
  const spec = byId[owned.id];
  const q = QUALITY[owned.q || 'new'];
  if (owned.broken) return { hashrate: 0, power: 0 };
  return { hashrate: spec.hashrate * q.perf * condFactor(owned) * effects(state).hash, power: spec.power * q.power };
}
export function psuEfficiency(owned) {
  const spec = byId[owned.id];
  const rank = QUALITY[owned.q || 'new'].rank;
  return Math.min(0.97, spec.efficiency - (3 - rank) * 0.01);
}

export function bestGpuAlgo(state, gpus) {
  let best = GPU_ALGOS[0]; let bestRevenue = -Infinity;
  for (const a of GPU_ALGOS) {
    const r = gpus.reduce((s, g) => s + gpuEffective(state, g).hash[a], 0) * revenuePerUnit(state, a);
    if (r > bestRevenue) { best = a; bestRevenue = r; }
  }
  return best;
}

export function rigStats(state, rig) {
  const frame = byId[rig.frameId];
  const os = OS[rig.os || 'linux'];
  // A card only works if its riser does, and only the OS's GPU limit is used.
  const active = rig.gpus.map((g, i) => ({ g, ok: !(rig.risers?.[i]?.broken) && i < os.maxGpus }));
  const eff = active.map(({ g, ok }) => {
    if (!ok) return { hash: { kawpow: 0, etchash: 0, autolykos: 0 }, power: 0 };
    const e = gpuEffective(state, g);
    if (os.hashBonus && byId[g.id].vendor === 'nvidia') {
      return { ...e, hash: Object.fromEntries(Object.entries(e.hash).map(([a, v]) => [a, v * (1 + os.hashBonus)])) };
    }
    return e;
  });
  const workingPsus = rig.psus.filter((p) => !p.broken);
  const dcLoad = frame.basePower + os.overheadW + eff.reduce((s, e) => s + e.power, 0);
  const psuCapacity = workingPsus.reduce((s, p) => s + byId[p.id].watts, 0);
  const efficiency = workingPsus.length
    ? workingPsus.reduce((s, p) => s + psuEfficiency(p) * byId[p.id].watts, 0) / psuCapacity : 0.9;
  const algo = rig.algo === 'auto' ? bestGpuAlgo(state, active.filter((x) => x.ok).map((x) => x.g)) : rig.algo;
  const hashrate = eff.reduce((s, e) => s + e.hash[algo], 0);
  const deadRisers = active.filter((x, i) => rig.risers?.[i]?.broken).length;

  let status = 'mining';
  if (!rig.on) status = 'off';
  else if (!rig.gpus.length) status = 'no-gpu';
  else if (!rig.boot) status = 'no-boot';
  else if (rig.boot.broken) status = 'boot-dead';
  else if (!workingPsus.length) status = rig.psus.length ? 'psu-dead' : 'no-psu';
  else if (dcLoad > psuCapacity) status = 'overloaded';
  else if (!hashrate) status = 'gpus-dead';

  const running = status === 'mining';
  return {
    kind: 'rig', dcLoad, psuCapacity, psuLoadPct: psuCapacity ? dcLoad / psuCapacity : 0, efficiency,
    wallPower: running ? dcLoad / efficiency : 0, algo, hashrate: running ? hashrate : 0, potentialHashrate: hashrate,
    unit: ALGOS[algo].unit, status, running, deadRisers, os: rig.os || 'linux',
    memThrottled: eff.filter((e) => e.memThrottled).length,
    overOsLimit: Math.max(0, rig.gpus.length - os.maxGpus),
    grossPerDay: running ? hashrate * revenuePerUnit(state, algo) : 0,
  };
}

export function rackStats(state, rack) {
  const spec = byId[rack.id];
  const heatPenalty = 1 + Math.max(0, (state.lastDeviceTemp ?? 40) - 60) * 0.0075;
  const units = rack.asics.map((a) => { const e = asicEffective(state, a); return { owned: a, ...e, power: e.power * heatPenalty }; });
  const load = units.filter((u) => u.owned.on).reduce((s, u) => s + u.power, 0);
  const overloaded = load > spec.pduKw * 1000;
  const miners = units.map((u) => {
    const running = u.owned.on && !u.owned.broken && !overloaded;
    const algo = byId[u.owned.id].algo;
    return {
      uid: u.owned.uid, algo, unit: ALGOS[algo].unit, running,
      wallPower: running ? u.power : 0, hashrate: running ? u.hashrate : 0,
      grossPerDay: running ? u.hashrate * revenuePerUnit(state, algo) : 0,
      status: u.owned.broken ? 'broken' : !u.owned.on ? 'off' : overloaded ? 'pdu-overload' : 'mining',
    };
  });
  return { load, pduLimit: spec.pduKw * 1000, overloaded, miners, free: spec.units - rack.asics.length };
}

// ------------------------------------------------------------------ energy: sun, load-shedding, dispatch

export function sunFactor(state, hour = state.hours % DAY_HOURS, day = state.day) {
  if (hour < 6 || hour >= 18) return 0;
  const south = ['za', 'au'].includes(state.region);
  const peakDay = south ? 355 : 172;   // longest days: December in the south, June in the north
  const season = 0.75 + 0.25 * Math.cos((2 * Math.PI * (day - peakDay)) / 365);
  return Math.sin((Math.PI * (hour - 6)) / 12) * season * state.weather;
}

export function sheddingAt(state, hour) {
  const stage = state.grid.stage;
  const blocks = SHED_BLOCK_STARTS.slice(0, SHED_BLOCKS[stage] || 0);
  return blocks.some((start) => hour >= start && hour < start + 2);
}

/** The next `hours` of load-shedding, for the UI schedule strip. */
export function sheddingSchedule(state, hours = 24) {
  const out = [];
  for (let i = 0; i < hours; i++) out.push(sheddingAt(state, (state.hours + i) % DAY_HOURS));
  return out;
}

export function energyCapacity(state) {
  const inv = state.energy.inverters.filter((i) => !i.broken).map((i) => byId[i.id]);
  const bats = state.energy.batteries.map((b) => ({ owned: b, spec: byId[b.id], capacity: byId[b.id].kwh * (1 - (b.wear || 0)) }));
  return {
    inverterKw: inv.reduce((s, i) => s + i.kw, 0),
    inverterEff: inv.length ? inv.reduce((s, i) => s + i.efficiency * i.kw, 0) / inv.reduce((s, i) => s + i.kw, 0) : 0,
    solarKwp: state.energy.solar.reduce((s, p) => s + byId[p.id].kwp, 0),
    batteries: bats,
    batteryKwh: bats.reduce((s, b) => s + b.capacity, 0),
    batteryStored: bats.reduce((s, b) => s + (b.owned.soc || 0), 0),
    batteryMaxKw: bats.reduce((s, b) => s + b.spec.maxKw, 0),
    generatorKw: state.energy.generators.reduce((s, g) => s + byId[g.id].kw, 0),
  };
}

/** Room-level picture: power demand, heat, temperature and earnings (before power availability). */
export function roomStats(state) {
  const loc = location(state);
  const fx = effects(state);
  const rigs = state.rigs.map((r) => rigStats(state, r));
  const racks = state.racks.map((r) => rackStats(state, r));
  const asics = racks.flatMap((r) => r.miners);
  const minerWatts = [...rigs, ...asics].reduce((s, x) => s + x.wallPower, 0);
  const coolingUnits = state.cooling.filter((c) => !c.broken).map((c) => byId[c.id]);
  const humidDay = state.weather <= 0.25;   // overcast / rainy: evaporative coolers struggle
  const rawCooling = coolingUnits.reduce((s, c) => s + c.cooling * (c.humid && humidDay ? 0.5 : 1), 0);
  const dustLoss = 1 - 0.35 * (state.dust || 0);
  const containment = state.facility?.[state.location]?.containment ? 1.25 : 1;
  const coolingCapacity = rawCooling * fx.cooling * dustLoss * containment;
  const coolingWatts = minerWatts > 0 ? coolingUnits.reduce((s, c) => s + c.power, 0) : 0;
  const demandWatts = minerWatts + coolingWatts;

  const ambient = loc.ambient + state.mods.ambient;
  const excess = Math.max(0, minerWatts - coolingCapacity);
  const roomTemp = ambient + (1.5 * minerWatts / 1000 + 6 * excess / 1000) / loc.roomSize;
  const deviceTemp = roomTemp + (minerWatts > 0 ? DEVICE_TEMP_OFFSET : 0);
  let throttle = 1;
  if (deviceTemp >= SHUTDOWN_AT) throttle = 0;
  else if (deviceTemp > THROTTLE_AT) throttle = Math.max(0, 1 - 0.02 * (deviceTemp - THROTTLE_AT));

  const offline = state.grid.offline;
  const factor = offline ? 0 : throttle;
  const hashByAlgo = {};
  let gross = 0;
  for (const x of [...rigs, ...asics]) {
    if (!x.running) continue;
    hashByAlgo[x.algo] = (hashByAlgo[x.algo] || 0) + x.hashrate * factor;
    gross += x.grossPerDay * factor;
  }
  return {
    location: loc, rigs, racks, asics, minerWatts, coolingWatts, demandWatts, coolingCapacity,
    ambient, roomTemp, deviceTemp, throttle, offline, offlineReason: state.grid.offlineReason,
    tripped: state.grid.breakerTripped, circuitPct: demandWatts / (loc.circuitKw * 1000),
    dust: state.dust || 0, containment: containment > 1,
    hashByAlgo, grossPerDay: gross, potentialGrossPerDay: [...rigs, ...asics].reduce((s, x) => s + x.grossPerDay, 0) * throttle,
    tariff: tariffUsd(state),
  };
}

/**
 * One hour of power. Order of supply: solar (through the inverter) -> grid -> batteries
 * (through the inverter) -> generator. If the load can't be met in full, the inverter or
 * changeover drops everything for the hour.
 */
export function dispatchHour(state, demandKw) {
  const cap = energyCapacity(state);
  const reg = region(state);
  const hour = state.hours % DAY_HOURS;
  const gridUp = !(reg.loadShedding && sheddingAt(state, hour)) && state.grid.outageHours <= 0;
  const hasInverter = cap.inverterKw > 0;
  const solarKw = hasInverter ? cap.solarKwp * sunFactor(state, hour) : 0;
  const result = { gridUp, solarKw, solarUsed: 0, gridKwh: 0, batteryOut: 0, batteryIn: 0, generatorKwh: 0, supplied: true, reason: '' };

  let need = demandKw;
  // 1. Solar first - free power, limited by the inverter.
  const solarToLoad = Math.min(solarKw * cap.inverterEff, need, cap.inverterKw);
  result.solarUsed = solarToLoad;
  need -= solarToLoad;
  let spareSolar = solarKw * cap.inverterEff - solarToLoad;

  if (gridUp) {
    result.gridKwh = need;
    need = 0;
  } else if (need > 0) {
    // 2. Grid down: batteries through whatever inverter capacity solar hasn't used.
    const invHeadroom = Math.max(0, cap.inverterKw - solarToLoad);
    const fromBattery = Math.min(need, invHeadroom, cap.batteryMaxKw, cap.batteryStored * cap.inverterEff);
    if (fromBattery >= need - 1e-9) {
      result.batteryOut = need;
      need = 0;
    } else if (cap.generatorKw >= need) {
      // 3. Generator via changeover switch.
      result.generatorKwh = need;
      need = 0;
    } else {
      result.supplied = false;
      result.reason = !hasInverter && !cap.generatorKw ? 'No backup power during the outage'
        : cap.inverterKw < demandKw && !cap.generatorKw ? `Inverter overloaded: ${demandKw.toFixed(1)} kW load on ${cap.inverterKw} kW`
        : 'Batteries flat';
    }
  }

  // Charge batteries: spare solar first, then (optionally) the grid while it's up.
  const room = cap.batteries.reduce((s, b) => s + Math.max(0, b.capacity - (b.owned.soc || 0)), 0);
  if (room > 0 && cap.batteries.length) {
    let charge = Math.min(room, cap.batteryMaxKw, spareSolar);
    spareSolar -= charge;
    if (gridUp && state.energy.gridCharge) {
      const fromGrid = Math.min(room - charge, cap.batteryMaxKw * 0.5);
      result.gridKwh += Math.max(0, fromGrid);
      charge += Math.max(0, fromGrid);
    }
    result.batteryIn = charge;
  }
  return result;
}

function applyBatteryFlow(state, outKwh, inKwh) {
  const bats = state.energy.batteries;
  if (!bats.length) return;
  const cap = energyCapacity(state);
  for (const b of cap.batteries) {
    const share = cap.batteryKwh ? b.capacity / cap.batteryKwh : 0;
    const out = outKwh * share / cap.inverterEff;
    const inn = inKwh * share * b.spec.efficiency;
    b.owned.soc = Math.max(0, Math.min(b.capacity, (b.owned.soc || 0) - out + inn));
    // Every full cycle wears the battery a little: at the rated cycle count it holds 70%.
    b.owned.wear = Math.min(0.6, (b.owned.wear || 0) + (out / b.spec.kwh) * (0.3 / b.spec.cycles) * effects(state).wear);
  }
}

// ------------------------------------------------------------------ estimates

export function itemDailyEstimate(state, item, grade = 'new') {
  const t = tariffUsd(state);
  const owned = { id: item.id, q: grade, cond: 1 };
  if (item.kind === 'gpu') {
    const e = gpuEffective(state, owned);
    const algo = bestGpuAlgo(state, [owned]);
    const gross = e.hash[algo] * revenuePerUnit(state, algo);
    const cost = (e.power / 0.9 / 1000) * DAY_HOURS * t;
    return { algo, gross, cost, profit: gross - cost, byAlgo: Object.fromEntries(GPU_ALGOS.map((a) => [a, e.hash[a] * revenuePerUnit(state, a)])) };
  }
  if (item.kind === 'asic') {
    const e = asicEffective(state, owned);
    const gross = e.hashrate * revenuePerUnit(state, item.algo);
    const cost = (e.power / 1000) * DAY_HOURS * t;
    return { algo: item.algo, gross, cost, profit: gross - cost };
  }
  return null;
}

// ------------------------------------------------------------------ buying & placing

function makeOwned(state, id, grade = 'new', cond = 1, paid = 0) {
  return { uid: newUid(state), id, q: grade, cond, broken: false, boughtDay: state.day, paid };
}

function place(state, owned) {
  const item = byId[owned.id];
  const loc = location(state);
  switch (item.kind) {
    case 'frame':
      if (state.rigs.length >= loc.rigSlots) return fail(`${loc.name} has room for ${loc.rigSlots} rig(s). Move somewhere bigger.`);
      state.rigs.push({ uid: owned.uid, frameId: owned.id, gpus: [], psus: [], algo: 'auto', on: true,
        risers: Array.from({ length: item.slots }, () => makeOwned(state, 'riser009s', 'new', 1)),
        boot: null, os: 'linux', windowsLicensed: false,
        boughtDay: owned.boughtDay, paid: owned.paid, name: `Rig ${state.rigs.length + 1}` });
      return { ok: true };
    case 'rack':
      if (state.racks.length >= loc.rackSlots) return fail(`${loc.name} has floor space for ${loc.rackSlots} rack(s).`);
      state.racks.push({ ...owned, asics: [] });
      return { ok: true };
    case 'asic': {
      const rack = state.racks.find((r) => r.asics.length < byId[r.id].units);
      if (!rack) return fail(state.racks.length ? 'All racks are full. Buy another rack.' : 'ASIC miners need a rack. Buy a shelf or rack first.');
      rack.asics.push({ ...owned, on: true });
      return { ok: true };
    }
    case 'cooling':
      if (state.cooling.length >= loc.coolingSlots) return fail(`${loc.name} fits ${loc.coolingSlots} cooling unit(s).`);
      state.cooling.push(owned);
      return { ok: true };
    case 'solar': {
      const kwp = energyCapacity(state).solarKwp + item.kwp;
      if (kwp > loc.roofKwp) return fail(`Not enough roof: ${loc.name} fits ${loc.roofKwp} kWp of panels.`);
      state.energy.solar.push(owned);
      return { ok: true };
    }
    case 'inverter': state.energy.inverters.push(owned); return { ok: true };
    case 'battery': state.energy.batteries.push({ ...owned, soc: 0, wear: 0 }); return { ok: true };
    case 'generator': state.energy.generators.push(owned); return { ok: true };
    default:
      state.inventory.push(owned);
      return { ok: true };
  }
}

export function buy(state, itemId) {
  const item = byId[itemId];
  if (!item) return fail('Unknown item');
  const price = buyPrice(state, item);
  if (state.cash < price) return fail(`Not enough cash: ${item.name} costs more than you have.`);
  const owned = makeOwned(state, itemId, 'new', 1, price);
  const placed = place(state, owned);
  if (!placed.ok) { state.nextUid--; return placed; }
  state.cash -= price;
  addLog(state, 'buy', `Bought a new ${item.name}.`);
  return { ok: true, uid: owned.uid, price };
}

// ------------------------------------------------------------------ used marketplace

function rollCondition(state, grade) {
  const ranges = { scrap: [0.25, 0.6], used: [0.55, 0.85], refurb: [0.85, 0.97], new: [1, 1], golden: [0.9, 1] };
  const [lo, hi] = ranges[grade];
  return +(lo + rng(state) * (hi - lo)).toFixed(2);
}

export function refreshListings(state, full = false) {
  state.listings = state.listings.filter((l) => l.expires > state.day && !full);
  while (state.listings.length < 10) {
    const roll = rng(state);
    const pool = roll < 0.7 ? GPUS : roll < 0.9 ? ASICS : PSUS;
    const item = pick(state, pool);
    const grade = QUALITY_ORDER[weighted(state, [15, 50, 30, 0, 2 + effects(state).scavenger])];
    const cond = rollCondition(state, grade);
    const price = Math.max(5, Math.round(buyPrice(state, item, grade) * (0.85 + rng(state) * 0.3) * (0.7 + 0.3 * cond)));
    state.listings.push({ id: `L${newUid(state)}`, itemId: item.id, q: grade, cond, price, expires: state.day + 3 + Math.floor(rng(state) * 5) });
  }
}

export function buyListing(state, listingId) {
  const i = state.listings.findIndex((l) => l.id === listingId);
  if (i === -1) return fail('That listing has gone.');
  const l = state.listings[i];
  if (state.cash < l.price) return fail('Not enough cash.');
  const owned = makeOwned(state, l.itemId, l.q, l.cond, l.price);
  const placed = place(state, owned);
  if (!placed.ok) return placed;
  state.cash -= l.price;
  state.listings.splice(i, 1);
  addLog(state, 'buy', `Bought a ${QUALITY[l.q].name.toLowerCase()} ${byId[l.itemId].name} second-hand.`);
  return { ok: true, uid: owned.uid };
}

// ------------------------------------------------------------------ junkyard, parts & crafting

function junkGrade(state, lot) {
  const s = effects(state).scavenger;
  const w = lot.grades.map((g, i) => g * (1 + 0.15 * s * i));
  return QUALITY_ORDER[weighted(state, w)];
}

export function buyLot(state, lotId) {
  const lot = JUNK_LOTS.find((l) => l.id === lotId);
  if (!lot) return fail('Unknown lot');
  const price = Math.round(lot.price * effects(state).price);
  if (state.cash < price) return fail('Not enough cash for this lot.');
  state.cash -= price;
  const models = GPUS.filter((g) => g.year <= lot.newestYear);
  const extra = Math.floor(effects(state).scavenger / 2);
  const count = lot.parts[0] + Math.floor(rng(state) * (lot.parts[1] - lot.parts[0] + 1)) + extra;
  const found = [];
  for (let i = 0; i < count; i++) {
    const model = pick(state, models);
    const grade = junkGrade(state, lot);
    if (rng(state) < lot.wholeCards * 0.3) {
      const owned = makeOwned(state, model.id, grade, rollCondition(state, grade));
      if (rng(state) < 0.35) owned.broken = true;
      state.inventory.push(owned);
      found.push({ kind: 'card', uid: owned.uid, id: model.id, q: grade, broken: owned.broken });
    } else if (rng(state) < 0.08) {
      const psu = pick(state, PSUS);
      const owned = makeOwned(state, psu.id, grade, rollCondition(state, grade));
      state.inventory.push(owned);
      found.push({ kind: 'psu', uid: owned.uid, id: psu.id, q: grade });
    } else {
      const type = pick(state, Object.keys(PART_TYPES));
      const part = makePart(state, type, model.id, grade);
      state.parts.push(part);
      found.push({ kind: 'part', ...part });
    }
    if (grade === 'golden') state.stats.goldens++;
  }
  state.stats.lotsOpened++;
  const goldens = found.filter((f) => f.q === 'golden').length;
  addLog(state, 'junk', `Opened "${lot.name}": ${found.length} items${goldens ? `, including ${goldens} golden!` : '.'}`);
  return { ok: true, found };
}

function makePart(state, type, modelId, grade) {
  const m = byId[modelId];
  const part = { uid: newUid(state), type, model: modelId, q: grade };
  if (type === 'memory') { part.memType = m.mem; part.vram = m.vram; }
  if (type === 'pcb') part.gen = m.gen;
  if (type === 'cooler') part.fans = m.fans;
  return part;
}

export function partLabel(part) {
  const m = byId[part.model];
  switch (part.type) {
    case 'core': return `${m.name} core`;
    case 'memory': return `${part.vram} GB ${part.memType} memory`;
    case 'pcb': return `${m.gen} PCB & VRM`;
    case 'cooler': return `${part.fans}-fan cooler`;
    default: return part.type;
  }
}

/** Which parts can complete a card built on this core. */
export function compatibleParts(state, coreUid) {
  const core = state.parts.find((p) => p.uid === coreUid && p.type === 'core');
  if (!core) return null;
  const m = byId[core.model];
  return {
    model: m,
    memory: state.parts.filter((p) => p.type === 'memory' && p.memType === m.mem && p.vram >= m.vram),
    pcb: state.parts.filter((p) => p.type === 'pcb' && p.gen === m.gen),
    cooler: state.parts.filter((p) => p.type === 'cooler' && p.fans >= m.fans),
  };
}

export function craftGpu(state, { core, memory, pcb, cooler }) {
  const options = compatibleParts(state, core);
  if (!options) return fail('Pick a GPU core first.');
  const need = { memory, pcb, cooler };
  for (const [type, uid] of Object.entries(need)) {
    if (!options[type].some((p) => p.uid === uid)) return fail(`That ${PART_TYPES[type].name.toLowerCase()} doesn't fit a ${options.model.name}.`);
  }
  if (state.cash < CRAFT_FEE) return fail('Not enough cash for the workshop fee.');
  const parts = { core, memory, pcb, cooler };
  const used = Object.fromEntries(Object.entries(parts).map(([t, uid]) => [t, state.parts.find((p) => p.uid === uid)]));
  const fx = effects(state);
  let rank = Object.entries(used).reduce((s, [t, p]) => s + PART_TYPES[t].share * QUALITY[p.q].rank, 0) + 0.08 * fx.builder;
  let grade = gradeAt(Math.min(3, Math.floor(rank + 0.35)));
  // A great core with good supporting parts can come out as a golden sample.
  const goldenChance = (used.core.q === 'golden' ? 0.5 : 0) + (rank >= 2.5 ? 0.04 + 0.03 * fx.builder : 0);
  if (rng(state) < goldenChance) grade = 'golden';
  state.parts = state.parts.filter((p) => !Object.values(parts).includes(p.uid));
  state.cash -= CRAFT_FEE;
  const owned = makeOwned(state, options.model.id, grade, 1, CRAFT_FEE);
  owned.crafted = true;
  state.inventory.push(owned);
  state.stats.crafted++;
  if (grade === 'golden') state.stats.goldens++;
  addLog(state, grade === 'golden' ? 'milestone' : 'craft', `Built a ${QUALITY[grade].name.toLowerCase()} ${options.model.name} on the workbench.`);
  return { ok: true, uid: owned.uid, grade };
}

/** Strip a GPU from inventory into parts. Broken cards may have a dead core. */
export function salvage(state, itemUid) {
  const i = state.inventory.findIndex((x) => x.uid === itemUid && byId[x.id].kind === 'gpu');
  if (i === -1) return fail('Only GPUs in inventory can be salvaged.');
  const card = state.inventory.splice(i, 1)[0];
  const rank = QUALITY[card.q].rank;
  const out = [];
  for (const type of Object.keys(PART_TYPES)) {
    if (type === 'core' && card.broken && rng(state) < 0.5) continue;
    const grade = gradeAt(rank - (rng(state) < 0.5 ? 1 : 0) - (card.broken ? 1 : 0));
    const part = makePart(state, type, card.id, grade);
    state.parts.push(part);
    out.push(part);
  }
  addLog(state, 'craft', `Salvaged a ${byId[card.id].name} into ${out.length} parts.`);
  return { ok: true, parts: out };
}

export function sellPart(state, partUid) {
  const i = state.parts.findIndex((p) => p.uid === partUid);
  if (i === -1) return fail('Part not found');
  const value = partValue(state, state.parts[i]);
  state.parts.splice(i, 1);
  state.cash += value;
  return { ok: true, value };
}

// ------------------------------------------------------------------ rigs & maintenance

function findOwned(state, itemUid) {
  const lists = [state.inventory, state.cooling, state.energy.solar, state.energy.inverters, state.energy.batteries, state.energy.generators,
    ...state.rigs.flatMap((r) => [r.gpus, r.psus, r.risers || []]), ...state.racks.map((r) => r.asics)];
  for (const rig of state.rigs) {
    if (rig.boot?.uid === itemUid) return { list: null, owned: rig.boot, rig };
  }
  for (const list of lists) {
    const i = list.findIndex((x) => x.uid === itemUid);
    if (i !== -1) return { list, index: i, owned: list[i] };
  }
  const ri = state.racks.findIndex((r) => r.uid === itemUid);
  if (ri !== -1) return { list: state.racks, index: ri, owned: state.racks[ri] };
  return null;
}

function takeFromInventory(state, itemUid, kind) {
  const i = state.inventory.findIndex((x) => x.uid === itemUid && byId[x.id].kind === kind);
  return i === -1 ? null : state.inventory.splice(i, 1)[0];
}

export function installGpu(state, rigUid, itemUid) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig) return fail('Rig not found');
  if (rig.gpus.length >= byId[rig.frameId].slots) return fail(`${rig.name} is full.`);
  const gpu = takeFromInventory(state, itemUid, 'gpu');
  if (!gpu) return fail('GPU not in inventory');
  rig.gpus.push(gpu);
  return { ok: true };
}

export function installPsu(state, rigUid, itemUid) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig) return fail('Rig not found');
  if (rig.psus.length >= byId[rig.frameId].psuSlots) return fail(`${rig.name} takes ${byId[rig.frameId].psuSlots} PSU(s).`);
  const psu = takeFromInventory(state, itemUid, 'psu');
  if (!psu) return fail('PSU not in inventory');
  rig.psus.push(psu);
  return { ok: true };
}

export function uninstall(state, rigUid, itemUid) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig) return fail('Rig not found');
  for (const list of [rig.gpus, rig.psus]) {
    const i = list.findIndex((x) => x.uid === itemUid);
    if (i !== -1) { state.inventory.push(list.splice(i, 1)[0]); return { ok: true }; }
  }
  return fail('Part not in this rig');
}

export function autoFill(state, rigUid) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig) return fail('Rig not found');
  const frame = byId[rig.frameId];
  const added = { psus: 0, gpus: 0, boot: 0 };
  const psus = state.inventory.filter((x) => byId[x.id].kind === 'psu' && !x.broken)
    .sort((a, b) => byId[b.id].watts - byId[a.id].watts);
  while (rig.psus.length < frame.psuSlots && psus.length) if (installPsu(state, rigUid, psus.shift().uid).ok) added.psus++;
  if (!rig.boot || rig.boot.broken) {
    const boot = state.inventory.filter((x) => byId[x.id].kind === 'boot' && !x.broken)
      .sort((a, b) => byId[a.id].reliability - byId[b.id].reliability)[0];
    if (boot && installBoot(state, rigUid, boot.uid).ok) added.boot++;
  }
  const score = (g) => {
    const e = gpuEffective(state, g);
    const algo = bestGpuAlgo(state, [g]);
    return e.hash[algo] * revenuePerUnit(state, algo) - (e.power / 900) * DAY_HOURS * tariffUsd(state);
  };
  const gpus = state.inventory.filter((x) => byId[x.id].kind === 'gpu' && !x.broken).sort((a, b) => score(b) - score(a));
  while (rig.gpus.length < frame.slots && gpus.length) if (installGpu(state, rigUid, gpus.shift().uid).ok) added.gpus++;
  if (!added.psus && !added.gpus && !added.boot) {
    const full = rig.gpus.length >= frame.slots && rig.psus.length >= frame.psuSlots && rig.boot;
    return fail(full ? 'This rig is already full' : 'Nothing in your inventory fits this rig. Buy GPUs, a PSU or a boot drive first.');
  }
  return { ok: true, added };
}

export function installBoot(state, rigUid, itemUid) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig) return fail('Rig not found');
  const drive = takeFromInventory(state, itemUid, 'boot');
  if (!drive) return fail('Boot drive not in inventory');
  if (rig.boot) state.inventory.push(rig.boot);
  rig.boot = drive;
  addLog(state, 'info', `${rig.name} now boots ${OS[rig.os || 'linux'].name} from a ${byId[drive.id].name}.`);
  return { ok: true };
}

export function swapRiser(state, rigUid, slot, itemUid) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig || !rig.risers[slot]) return fail('Riser slot not found');
  const riser = takeFromInventory(state, itemUid, 'riser');
  if (!riser) return fail('Riser not in inventory');
  const old = rig.risers[slot];
  rig.risers[slot] = riser;
  if (!old.broken) state.inventory.push(old);
  return { ok: true };
}

export function setOs(state, rigUid, os) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig || !OS[os]) return fail('Invalid');
  if (os === 'windows' && !rig.windowsLicensed) {
    const cost = Math.round(OS.windows.licence * effects(state).price);
    if (state.cash < cost) return fail('Not enough cash for a Windows licence.');
    state.cash -= cost;
    rig.windowsLicensed = true;
  }
  rig.os = os;
  addLog(state, 'info', `${rig.name} now runs ${OS[os].name}.`);
  return { ok: true };
}

/** Apply a thermal pad kit or copper shims to a GPU (in inventory or in a rig). */
export function applyMod(state, gpuUid, modUid) {
  const found = findOwned(state, gpuUid);
  if (!found || byId[found.owned.id].kind !== 'gpu') return fail('GPU not found');
  const mi = state.inventory.findIndex((x) => x.uid === modUid && byId[x.id].kind === 'mod');
  if (mi === -1) return fail('Kit not in inventory');
  const mod = byId[state.inventory[mi].id];
  const gpu = found.owned;
  gpu.mods = gpu.mods || {};
  if (mod.consumable) {
    // One-off service items (e.g. new fans) restore condition and are used up.
    if ((gpu.cond ?? 1) >= 0.99) return fail('This card is already in perfect condition.');
    state.inventory.splice(mi, 1);
    gpu.cond = Math.min(1, (gpu.cond ?? 1) + 0.25);
    addLog(state, 'craft', `Fitted new fans to a ${byId[gpu.id].name}.`);
    return { ok: true };
  }
  if (gpu.mods[mod.id]) return fail('This card already has that mod.');
  if (mod.needs && !gpu.mods[mod.needs]) return fail('Apply fresh thermal pads first.');
  state.inventory.splice(mi, 1);
  gpu.mods[mod.id] = true;
  addLog(state, 'craft', `${{ pads: 'Re-padded', shim: 'Copper-shimmed', paste: 'Re-pasted' }[mod.id] || 'Modded'} a ${byId[gpu.id].name}.`);
  return { ok: true };
}

export function cleanCost(state) {
  return Math.round((15 + 10 * (state.rigs.length + state.racks.length)) * effects(state).price);
}
export function cleanDust(state) {
  if ((state.dust || 0) < 0.05) return fail('The room is already clean.');
  const cost = cleanCost(state);
  if (state.cash < cost) return fail('Not enough cash to clean.');
  state.cash -= cost;
  state.dust = 0;
  addLog(state, 'info', 'Blew out the dust from every heatsink and filter.');
  return { ok: true, cost };
}

export function facilityPrice(state, id) {
  const f = FACILITY.find((x) => x.id === id);
  return Math.round(f.price * location(state).roomSize * effects(state).price);
}
export function buyFacility(state, id) {
  const f = FACILITY.find((x) => x.id === id);
  if (!f) return fail('Unknown upgrade');
  state.facility[state.location] = state.facility[state.location] || {};
  if (state.facility[state.location][id]) return fail('Already installed here.');
  const price = facilityPrice(state, id);
  if (state.cash < price) return fail('Not enough cash.');
  state.cash -= price;
  state.facility[state.location][id] = true;
  addLog(state, 'buy', `Installed ${f.name} in the ${location(state).name}.`);
  return { ok: true };
}

export function repairCost(state, owned) {
  const spec = byId[owned.id];
  return Math.round(spec.price * effects(state).price * (0.1 + 0.3 * (1 - (owned.cond ?? 1)) + (owned.broken ? 0.25 : 0)));
}

export function repair(state, itemUid) {
  const found = findOwned(state, itemUid);
  if (!found || !byId[found.owned.id]) return fail('Item not found');
  const o = found.owned;
  if (!o.broken && (o.cond ?? 1) >= 0.99) return fail('Already in perfect condition.');
  const cost = repairCost(state, o);
  if (state.cash < cost) return fail('Not enough cash for the repair.');
  state.cash -= cost;
  o.broken = false;
  o.cond = Math.max(o.cond ?? 1, o.q === 'scrap' ? 0.7 : 0.97);
  addLog(state, 'info', `Repaired ${byId[o.id].name}.`);
  return { ok: true, cost };
}

export function sell(state, itemUid) {
  const ri = state.rigs.findIndex((r) => r.uid === itemUid);
  if (ri !== -1) {
    const rig = state.rigs[ri];
    if (rig.gpus.length || rig.psus.length) return fail('Remove the GPUs and PSUs before selling the rig kit.');
    state.rigs.splice(ri, 1);
    const value = sellValue(state, { id: rig.frameId, boughtDay: rig.boughtDay });
    state.cash += value;
    return { ok: true, value };
  }
  const found = findOwned(state, itemUid);
  if (!found) return fail('Item not found');
  if (found.owned.asics?.length) return fail('Move or sell the miners in this rack first.');
  if (!found.list || state.rigs.some((r) => r.gpus.includes(found.owned) || r.psus.includes(found.owned) || (r.risers || []).includes(found.owned))) return fail('Uninstall it from the rig first.');
  found.list.splice(found.index, 1);
  const value = sellValue(state, found.owned);
  state.cash += value;
  addLog(state, 'sell', `Sold ${byId[found.owned.id].name} for {{usd:${value}}}.`);
  return { ok: true, value };
}

export function setRigAlgo(state, rigUid, algo) {
  const rig = state.rigs.find((r) => r.uid === rigUid);
  if (!rig || !(algo === 'auto' || GPU_ALGOS.includes(algo))) return fail('Invalid');
  rig.algo = algo;
  return { ok: true };
}

export function toggle(state, itemUid) {
  const target = state.rigs.find((r) => r.uid === itemUid) || state.racks.flatMap((r) => r.asics).find((a) => a.uid === itemUid);
  if (!target) return fail('Not found');
  target.on = !target.on;
  return { ok: true, on: target.on };
}

export function resetBreaker(state) {
  if (!state.grid.breakerTripped) return fail('The breaker is fine.');
  const room = roomStats(state);
  const solarHelp = energyCapacity(state).inverterKw ? Math.min(energyCapacity(state).inverterKw, energyCapacity(state).solarKwp * sunFactor(state)) : 0;
  const gridKw = room.demandWatts / 1000 - solarHelp;
  if (gridKw > room.location.circuitKw) return fail(`Still ${gridKw.toFixed(1)} kW on a ${room.location.circuitKw} kW circuit. Switch something off first.`);
  state.grid.breakerTripped = false;
  addLog(state, 'info', 'Breaker reset. Miners are back online.');
  return { ok: true };
}

export function moveTo(state, locationId) {
  const target = LOCATIONS.find((l) => l.id === locationId);
  const current = location(state);
  if (!target) return fail('Unknown location');
  if (LOCATIONS.indexOf(target) <= LOCATIONS.indexOf(current)) return fail('You can only move up.');
  const price = Math.round(target.price * effects(state).price);
  if (state.cash < price) return fail(`Moving to ${target.name} costs more than you have.`);
  state.cash -= price;
  state.location = locationId;
  state.grid.breakerTripped = false;
  addLog(state, 'milestone', `Moved operations to ${target.name}.`);
  return { ok: true };
}

export function setTariff(state, tariffLocal) {
  if (!(tariffLocal > 0 && tariffLocal < 1000)) return fail('Enter a positive price per kWh.');
  state.tariffLocal = tariffLocal;
  return { ok: true };
}

export function setFx(state, fx) {
  if (fx > 0) state.fx = fx;
}

// ------------------------------------------------------------------ prestige

export function canFork(state) {
  return netWorth(state) >= forkThreshold(state.prestige.forks);
}

export function hardFork(state) {
  if (!canFork(state)) return fail(`Reach a net worth of {{usd:${forkThreshold(state.prestige.forks)}}} first.`);
  const worth = netWorth(state);
  const reward = forkReward(worth, state.prestige.forks);
  const prestige = {
    ...state.prestige,
    forks: state.prestige.forks + 1,
    shards: state.prestige.shards + reward,
    lifetimeShards: state.prestige.lifetimeShards + reward,
    bestNetWorth: Math.max(state.prestige.bestNetWorth, worth),
  };
  const next = newGame((state.seed * 7 + 13) % 2147483647, { prestige, region: state.region, tariffLocal: state.tariffLocal, fx: state.fx });
  return { ok: true, state: next, reward };
}

export function buyUpgrade(state, upgradeId) {
  const up = UPGRADES.find((u) => u.id === upgradeId);
  if (!up) return fail('Unknown upgrade');
  const level = state.prestige.upgrades[upgradeId] || 0;
  const cost = upgradeCost(up, level);
  if (state.prestige.shards < cost) return fail(`Needs ${cost} Fork Shards.`);
  state.prestige.shards -= cost;
  state.prestige.upgrades[upgradeId] = level + 1;
  return { ok: true, level: level + 1 };
}

// ------------------------------------------------------------------ time

function stepMarket(state) {
  const m = state.market;
  if (--m.regimeDaysLeft <= 0) {
    const roll = rng(state);
    m.regime = roll < 0.35 ? 'bull' : roll < 0.65 ? 'bear' : 'sideways';
    m.regimeDaysLeft = 30 + Math.floor(rng(state) * 90);
    addLog(state, 'market', m.regime === 'bull' ? 'Bull market: prices are climbing.'
      : m.regime === 'bear' ? 'Bear market: prices are sliding.' : 'The market is moving sideways.');
  }
  const drift = { bull: 0.004, bear: -0.004, sideways: 0 }[m.regime];
  const shared = gaussian(state) * 0.03;
  for (const a of Object.keys(ALGOS)) {
    const own = gaussian(state) * 0.025;
    const reversion = -0.002 * Math.log(m.index[a]);
    m.index[a] = Math.min(8, Math.max(0.15, m.index[a] * Math.exp(drift + reversion + shared + own)));
    m.difficulty[a] *= 1 + 0.0007 + 0.0006 * Math.max(0, m.index[a] - 1);
    m.history[a].push(+m.index[a].toFixed(4));
    if (m.history[a].length > 120) m.history[a].shift();
  }
}

function stepGrid(state) {
  const reg = region(state);
  const g = state.grid;
  if (reg.loadShedding) {
    if (--g.stageDaysLeft <= 0) {
      const winter = ['za', 'au'].includes(state.region) ? (state.day % 365 > 140 && state.day % 365 < 250) : false;
      const up = winter ? 0.45 : 0.3;
      const roll = rng(state);
      const before = g.stage;
      if (roll < up) g.stage = Math.min(8, g.stage + 1 + (rng(state) < 0.25 ? 1 : 0));
      else if (roll < up + 0.4) g.stage = Math.max(0, g.stage - 1);
      g.stageDaysLeft = 2 + Math.floor(rng(state) * 6);
      if (g.stage !== before) {
        addLog(state, g.stage > before ? 'warning' : 'info', g.stage === 0
          ? 'Load-shedding suspended. Enjoy it while it lasts.'
          : `Load-shedding moves to Stage ${g.stage}: ${SHED_BLOCKS[g.stage] * 2} hours off per day.`);
      }
    }
  }
  if (rng(state) < reg.outageRate) {
    g.outageHours = 2 + Math.floor(rng(state) * 7);
    addLog(state, 'warning', `Unplanned grid outage: ${g.outageHours} hours without mains power.`);
  }
}

function stepEvents(state) {
  const mods = state.mods;
  if (mods.ambientDaysLeft > 0 && --mods.ambientDaysLeft === 0) {
    mods.ambient = 0;
    addLog(state, 'info', 'The heatwave is over.');
  }
  const roll = rng(state);
  if (roll < 0.012 && mods.ambient === 0) {
    mods.ambient = 8; mods.ambientDaysLeft = 4 + Math.floor(rng(state) * 5);
    addLog(state, 'warning', `Heatwave! Ambient temperature +8 °C for ${mods.ambientDaysLeft} days.`);
  } else if (roll < 0.02) {
    mods.gpuPrice = 1.35;
    addLog(state, 'market', 'GPU shortage: graphics card prices are up 35%.');
  } else if (roll < 0.028) {
    mods.asicPrice = 0.75;
    addLog(state, 'market', 'ASIC fire sale: miner prices are down 25%.');
  } else if (roll < 0.033) {
    for (const a of Object.keys(ALGOS)) state.market.index[a] *= 0.7;
    addLog(state, 'market', 'Flash crash! Coin prices dropped 30% overnight.');
  } else if (roll < 0.038) {
    for (const a of Object.keys(ALGOS)) state.market.index[a] *= 1.25;
    addLog(state, 'market', 'Rally! Coin prices jumped 25%.');
  }
  mods.gpuPrice += (1 - mods.gpuPrice) * 0.05;
  mods.asicPrice += (1 - mods.asicPrice) * 0.05;

  // Weather for solar: mostly sunny, sometimes cloudy.
  const w = rng(state);
  state.weather = w < 0.6 ? 1 : w < 0.85 ? 0.6 : 0.25;

  if (state.day >= HALVING_FIRST_DAY + state.market.halvings * HALVING_EVERY_DAYS) {
    state.market.halvings += 1;
    addLog(state, 'milestone', 'Bitcoin halving! SHA-256 block rewards are cut in half.');
  }
}

/** Daily wear: heat, age and quality decide how fast hardware degrades and fails. */
function stepWear(state, room) {
  const fx = effects(state);
  const heat = Math.max(0, (room.deviceTemp - 65) / 15);
  const wearOne = (owned, label) => {
    if (owned.broken) return;
    const q = QUALITY[owned.q || 'new'];
    const padded = (owned.mods?.shim ? 0.55 : owned.mods?.pads ? 0.7 : 1) * (owned.mods?.paste ? 0.85 : 1);
    owned.cond = Math.max(0, (owned.cond ?? 1) - 0.0008 * (1 + heat) * fx.wear * padded);
    const p = 0.0006 * q.fail * (1 + 3 * (1 - owned.cond)) * (1 + heat) * fx.wear * padded;
    if (rng(state) < p) {
      owned.broken = true;
      addLog(state, 'warning', `${byId[owned.id].name}${label ? ` in ${label}` : ''} has failed. Repair or salvage it.`);
    }
  };
  state.rigs.forEach((r, i) => {
    if (!room.rigs[i].running) return;
    r.gpus.forEach((g) => wearOne(g, r.name));
    r.psus.forEach((p) => wearOne(p, r.name));
    // Risers and boot drives fail too - cheap ones far more often.
    (r.risers || []).forEach((riser, k) => {
      if (riser.broken || !r.gpus[k]) return;
      const spec = byId[riser.id];
      if (rng(state) < 0.0007 * spec.reliability * (1 + heat) * fx.wear) {
        riser.broken = true;
        addLog(state, 'warning', `A PCIe riser in ${r.name} died: ${byId[r.gpus[k].id].name} dropped offline. Swap the riser.`);
      }
      // A SATA-powered riser can overheat its connector and start a fire.
      if (spec.fireRisk && gpuEffective(state, r.gpus[k]).power > 60 && rng(state) < 0.0015 * spec.fireRisk * (1 + heat)) {
        riser.broken = true;
        r.gpus[k].broken = true;
        if (r.gpus[k + 1] && rng(state) < 0.5) r.gpus[k + 1].broken = true;
        r.on = false;
        addLog(state, 'warning', `🔥 FIRE! A SATA-powered riser melted in ${r.name}. The rig is off and cards are damaged. Use 6-pin risers.`);
      }
    });
    if (r.boot && !r.boot.broken && rng(state) < 0.0005 * byId[r.boot.id].reliability * fx.wear) {
      r.boot.broken = true;
      addLog(state, 'warning', `${r.name}'s ${byId[r.boot.id].name} failed: the rig can't boot. Replace the boot drive.`);
    }
  });
  state.racks.forEach((rack) => rack.asics.forEach((a) => { if (a.on) wearOne(a, ''); }));
}

function payBill(state) {
  const p = state.power;
  const amount = Math.round((p.gridCost + p.dieselCost) * 100) / 100;
  state.cash -= amount;
  state.stats.powerPaid += amount;
  addLog(state, 'bill', `Power bill: ${Math.round(p.gridKwh).toLocaleString()} kWh from the grid${p.dieselCost ? ' plus diesel' : ''}. Paid {{usd:${amount.toFixed(2)}}}.`);
  state.lastBill = { day: state.day, kwh: p.gridKwh, gridCost: p.gridCost, diesel: p.dieselCost, total: amount };
  p.gridKwh = 0; p.gridCost = 0; p.dieselCost = 0; p.lastBillDay = state.day;
  if (state.cash < 0) {
    const interest = Math.round(-state.cash * 0.02);
    state.cash -= interest;
    addLog(state, 'warning', `Overdrawn: {{usd:${interest}}} interest charged. Sell hardware or cut power use.`);
  }
  if (state.cash < -10000) {
    state.gameOver = true;
    addLog(state, 'warning', 'Bankrupt. The bank has repossessed your mining operation.');
  }
}

/** Advance the world by `hours` of game time (fractions carry over, so time never drifts). */
export function advance(state, hours) {
  if (state.gameOver) return;
  state.carry = (state.carry || 0) + hours;
  while (state.carry >= 1 && !state.gameOver) {
    state.carry -= 1;
    const dayBefore = Math.floor(state.day);
    state.hours += 1;
    state.day = state.hours / DAY_HOURS;

    const room = roomStats({ ...state, grid: { ...state.grid, offline: false } });
    state.lastDeviceTemp = room.deviceTemp;
    const demandKw = state.grid.breakerTripped ? 0 : room.demandWatts / 1000;
    const flow = dispatchHour(state, demandKw);

    // The breaker only sees what comes from the grid.
    if (!state.grid.breakerTripped && flow.gridUp && flow.gridKwh > room.location.circuitKw) {
      state.grid.breakerTripped = true;
      addLog(state, 'warning', `Breaker tripped! ${flow.gridKwh.toFixed(1)} kW from the grid on a ${room.location.circuitKw} kW circuit.`);
    }

    const wasOffline = state.grid.offline;
    state.grid.offline = state.grid.breakerTripped || !flow.supplied;
    state.grid.offlineReason = state.grid.breakerTripped ? 'Breaker tripped' : flow.reason;
    if (state.grid.offline && !wasOffline && !state.grid.breakerTripped && demandKw > 0 && state.lastOutageLogDay !== Math.floor(state.day)) {
      state.lastOutageLogDay = Math.floor(state.day);   // one entry per day keeps the log readable
      addLog(state, 'outage', `Miners down: ${flow.reason}.`);
    }

    const online = !state.grid.offline;
    const gross = online ? room.grossPerDay / DAY_HOURS : 0;
    const t = tariffUsd(state) * tariffHourMult(state);
    const gridKwh = online ? flow.gridKwh : (flow.gridUp ? flow.gridKwh - demandKw : 0);
    const gridCost = Math.max(0, gridKwh) * t;
    const gens = state.energy.generators.map((g) => byId[g.id]);
    const litresPerKwh = gens.length ? gens.reduce((a, g) => a + g.litresPerKwh * g.kw, 0) / gens.reduce((a, g) => a + g.kw, 0) : 0.3;
    const dieselCost = online ? flow.generatorKwh * litresPerKwh * DIESEL_USD_PER_LITRE : 0;
    if (online || flow.batteryIn) applyBatteryFlow(state, online ? flow.batteryOut : 0, flow.batteryIn);

    state.cash += gross;
    state.stats.minedUsd += gross;
    state.stats.earnedToday += gross;
    state.stats.costToday += gridCost + dieselCost;
    state.power.gridKwh += Math.max(0, gridKwh);
    state.power.gridCost += gridCost;
    state.power.dieselCost += dieselCost;
    if (state.grid.outageHours > 0) {
      state.grid.outageHours -= 1;
      if (state.grid.outageHours === 0) addLog(state, 'info', 'Mains power is back.');
    }

    if (Math.floor(state.day) > dayBefore) {
      state.stats.bestDay = Math.max(state.stats.bestDay, state.stats.earnedToday - state.stats.costToday);
      state.stats.earnedToday = 0;
      state.stats.costToday = 0;
      stepMarket(state);
      stepGrid(state);
      stepEvents(state);
      stepWear(state, room);
      const filters = state.facility?.[state.location]?.filters ? 0.4 : 1;
      if (room.minerWatts > 0) state.dust = Math.min(1, (state.dust || 0) + 0.006 * filters * Math.min(3, 1 + room.minerWatts / 5000));
      refreshListings(state);
      if (state.day - state.power.lastBillDay >= BILL_PERIOD_DAYS) payBill(state);
      const worth = netWorth(state);
      if (worth > state.prestige.bestNetWorth) state.prestige.bestNetWorth = worth;
    }
  }
}

// ------------------------------------------------------------------ goals

/** Net profit per day if the grid stays up: what the player's operation is really worth per day. */
export function profitPerDay(state, room = roomStats(state)) {
  return room.potentialGrossPerDay - room.demandWatts / 1000 * DAY_HOURS * tariffUsd(state);
}

/** A guided path through the early game, then endless profit milestones. Rewards are in USD. */
export const GOALS = [
  { id: 'rig', title: 'Buy a rig kit', hint: 'Vendors → Rig kits. The 4-GPU kit is a good start.', reward: 25, progress: (s) => +(s.rigs.length > 0) },
  { id: 'psu', title: 'Put a power supply in your rig', hint: 'Buy a PSU, then click the rig on the Floor and press Add.', reward: 25, progress: (s) => +s.rigs.some((r) => r.psus.length) },
  { id: 'gpu', title: 'Install a graphics card', hint: 'Buy a GPU (check "Net after power" on the card), then Add it to the rig.', reward: 30, progress: (s) => +s.rigs.some((r) => r.gpus.length) },
  { id: 'boot', title: 'Fit a boot drive', hint: 'A 16 GB USB flash drive under Vendors → Risers, boot & thermal runs the Linux mining OS.', reward: 20, progress: (s) => +s.rigs.some((r) => r.boot) },
  { id: 'mining', title: 'Start mining', hint: 'A rig needs a PSU, at least one GPU and a boot drive. The Advisor tells you what is missing.', reward: 50, progress: (s, room) => +room.rigs.some((r) => r.running) },
  { id: 'profit5', title: 'Make {{usd:5}} a day after power', hint: 'Add more efficient cards. Cards that lose money at your tariff do more harm than good.', reward: 75, progress: (s, room) => Math.max(0, Math.min(1, profitPerDay(s, room) / 5)) },
  { id: 'junk', title: 'Open a junkyard lot', hint: 'Cheap bins hide parts and the odd golden sample.', reward: 20, progress: (s) => +(s.stats.lotsOpened > 0) },
  { id: 'craft', title: 'Build a card on the Workbench', hint: 'Match a core with memory, a PCB and a cooler from junkyard parts.', reward: 75, progress: (s) => +(s.stats.crafted > 0) },
  { id: 'fullrig', title: 'Fill every GPU slot in a rig', hint: 'Use Auto-fill on the Floor once you have enough cards.', reward: 100, progress: (s) => Math.max(0, ...s.rigs.map((r) => r.gpus.length / byId[r.frameId].slots)) },
  { id: 'backup', title: 'Ride out load-shedding', hint: 'An inverter plus batteries keeps miners running when the grid goes down.', reward: 150, progress: (s) => {
    const cap = energyCapacity(s); return (cap.inverterKw > 0 ? 0.5 : 0) + (cap.batteryKwh > 0 || cap.generatorKw > 0 ? 0.5 : 0);
  } },
  { id: 'profit25', title: 'Make {{usd:25}} a day after power', hint: 'More rigs, better cards, or a second-hand ASIC.', reward: 250, progress: (s, room) => Math.max(0, Math.min(1, profitPerDay(s, room) / 25)) },
  { id: 'asic', title: 'Run an ASIC miner', hint: 'ASICs need a rack. Older models are cheap but need cheap power.', reward: 150, progress: (s, room) => +room.racks.some((r) => r.miners.some((m) => m.running)) },
  { id: 'move', title: 'Move out of the bedroom', hint: 'Vendors → Locations. Bigger places mean more circuits, more slots and cheaper power.', reward: 300, progress: (s) => +(LOCATIONS.findIndex((l) => l.id === s.location) > 0) },
  { id: 'solar', title: 'Install solar panels', hint: 'Panels need an inverter. They cut your daytime bill and charge batteries.', reward: 300, progress: (s) => +(s.energy.solar.length > 0) },
  { id: 'profit100', title: 'Make {{usd:100}} a day after power', hint: 'Scale up: racks of ASICs, full rigs and cheap power.', reward: 750, progress: (s, room) => Math.max(0, Math.min(1, profitPerDay(s, room) / 100)) },
];
const ENDLESS_START = 250;

/** The goal the player is working on now: the first unfinished guided goal, then ever-bigger profit targets. */
export function currentGoal(state, room = roomStats(state)) {
  const g = state.goals || { done: [], tier: 0 };
  const next = GOALS.find((x) => !g.done.includes(x.id));
  if (next) return { ...next, value: next.progress(state, room), index: GOALS.indexOf(next), total: GOALS.length };
  const target = ENDLESS_START * 2 ** (g.tier || 0);
  return {
    id: `endless${g.tier || 0}`, endless: true, title: `Make {{usd:${target}}} a day after power`,
    hint: 'Keep growing: every milestone doubles the target and the reward.', reward: target * 8,
    value: Math.max(0, Math.min(1, profitPerDay(state, room) / target)), index: GOALS.length + (g.tier || 0), total: null,
  };
}

/** Pay out every goal that is complete right now. Returns the goals finished in this call. */
export function checkGoals(state, room = roomStats(state)) {
  if (!state.goals) {
    // Saves from before goals existed: tick off what's already done without paying for it again.
    state.goals = { done: GOALS.filter((x) => x.progress(state, room) >= 1).map((x) => x.id), tier: 0 };
  }
  const finished = [];
  for (let guard = 0; guard < 40; guard++) {
    const goal = currentGoal(state, room);
    if (goal.value < 1) break;
    if (goal.endless) state.goals.tier = (state.goals.tier || 0) + 1;
    else state.goals.done.push(goal.id);
    state.cash += goal.reward;
    addLog(state, 'milestone', `Goal complete: ${goal.title}. Reward {{usd:${goal.reward}}}.`);
    finished.push(goal);
  }
  return finished;
}

// ------------------------------------------------------------------ offline progress

const OFFLINE_MAX_HOURS = 7 * DAY_HOURS;
/** Catch up on time spent away: one game hour per real minute, up to a game week. */
export function catchUp(state, awayMs) {
  const hours = Math.min(OFFLINE_MAX_HOURS, Math.floor(awayMs / 60000));
  if (hours < 1 || state.gameOver) return null;
  const before = { cash: state.cash, mined: state.stats.minedUsd, day: state.day };
  advance(state, hours);
  return {
    hours, days: state.day - before.day,
    cashChange: state.cash - before.cash,
    mined: state.stats.minedUsd - before.mined,
  };
}

// ------------------------------------------------------------------ advisor

export function advise(state) {
  const room = roomStats(state);
  const cap = energyCapacity(state);
  const reg = region(state);
  const tips = [];
  const add = (level, text) => tips.push({ level, text });
  const loc = room.location;
  const t = tariffUsd(state);

  if (room.tripped) add('critical', `The breaker tripped. Reduce the load below ${loc.circuitKw} kW (or add solar), then reset it.`);
  else if (room.offline) add('critical', `Miners are down: ${room.offlineReason}.`);
  if (reg.loadShedding && state.grid.stage > 0 && !cap.inverterKw && !cap.generatorKw && room.minerWatts)
    add('warning', `Stage ${state.grid.stage} load-shedding: you lose ${SHED_BLOCKS[state.grid.stage] * 2} mining hours a day. An inverter + batteries (or a generator) keeps you running.`);
  if (cap.batteries.length && !cap.inverterKw) add('warning', 'Batteries do nothing without an inverter.');
  if (cap.solarKwp && !cap.inverterKw) add('warning', 'Solar panels need an inverter before they produce anything.');
  if (cap.inverterKw && room.demandWatts / 1000 > cap.inverterKw && !cap.generatorKw)
    add('warning', `Your load (${(room.demandWatts / 1000).toFixed(1)} kW) is bigger than your inverter (${cap.inverterKw} kW). It will trip when the grid goes down.`);
  const worn = cap.batteries.find((b) => (b.owned.wear || 0) >= 0.3);
  if (worn) add('info', `${worn.spec.name} has lost ${Math.round(worn.owned.wear * 100)}% capacity. Time to replace it.`);

  if (room.deviceTemp >= SHUTDOWN_AT && room.minerWatts) add('critical', `Hardware at ${Math.round(room.deviceTemp)} °C: miners have shut down. Add cooling now.`);
  else if (room.throttle < 1 && room.minerWatts) add('warning', `Hardware at ${Math.round(room.deviceTemp)} °C is throttling to ${Math.round(room.throttle * 100)}%. Heat also wears parts out faster.`);
  if (room.circuitPct > 0.85 && !room.tripped && room.circuitPct <= 1) add('warning', `Circuit at ${Math.round(room.circuitPct * 100)}%. One more miner and the breaker goes.`);

  if ((state.dust || 0) > 0.4) add('warning', `Dust has cut your cooling by ${Math.round(state.dust * 35)}%. Clean the room (and fit intake filters).`);
  room.rigs.forEach((r, i) => {
    const rig = state.rigs[i];
    if (r.status === 'no-boot' && rig.gpus.length) add('critical', `${rig.name} has no boot drive. Install a USB flash drive or SSD so it can load its OS.`);
    if (r.status === 'boot-dead') add('critical', `${rig.name}'s boot drive failed. Replace it.`);
    if (r.deadRisers) add('warning', `${rig.name} has ${r.deadRisers} dead riser(s): those cards are offline.`);
    if (r.memThrottled) add('info', `${r.memThrottled} GDDR6X card(s) in ${rig.name} are memory-throttling. Re-pad them (thermal pad kit) for ~15% more hashrate.`);
    if (r.overOsLimit) add('warning', `${rig.name} has more GPUs than Windows supports: ${r.overOsLimit} idle. Switch to the Linux mining OS.`);
    if ((rig.risers || []).some((x, k) => byId[x.id].fireRisk && rig.gpus[k])) add('warning', `${rig.name} uses SATA-powered risers. They can overheat and catch fire. Swap to 6-pin risers.`);
    if (r.status === 'overloaded') add('critical', `${rig.name} won't boot: ${Math.round(r.dcLoad)} W on ${r.psuCapacity} W of PSU.`);
    else if (r.status === 'no-psu' && rig.gpus.length) add('warning', `${rig.name} has GPUs but no power supply.`);
    else if (r.status === 'psu-dead') add('critical', `${rig.name}'s PSU has failed. Repair or replace it.`);
    else if (r.running && r.psuLoadPct > 0.9) add('info', `${rig.name}'s PSU is at ${Math.round(r.psuLoadPct * 100)}%. Keep PSUs under 80% for efficiency and lifespan.`);
    const broken = rig.gpus.filter((g) => g.broken).length;
    if (broken) add('warning', `${rig.name} has ${broken} dead GPU(s). Repair them or salvage them for parts.`);
    if (r.running) {
      const cost = r.wallPower / 1000 * DAY_HOURS * t;
      if (r.grossPerDay < cost) add('warning', `${rig.name} loses money at your tariff. Switch algorithm, undervolt with better parts, or find cheaper power.`);
    }
  });
  room.racks.forEach((rk, i) => {
    if (rk.overloaded) add('critical', `Rack ${i + 1}'s PDU is overloaded (${(rk.load / 1000).toFixed(1)} kW on ${rk.pduLimit / 1000} kW). Its miners are off.`);
    rk.miners.forEach((m, j) => {
      if (!m.running) return;
      const cost = m.wallPower / 1000 * DAY_HOURS * t;
      if (m.grossPerDay < cost) add('warning', `${byId[state.racks[i].asics[j].id].name} loses money at your tariff. Old ASICs need cheap power.`);
    });
  });
  const idle = state.inventory.filter((x) => byId[x.id].kind === 'gpu' && !x.broken).length;
  if (idle) {
    const room = state.rigs.some((r) => r.gpus.length < byId[r.frameId].slots);
    const loc = location(state);
    add('info', room ? `${idle} working GPU(s) in inventory. Install them to earn.`
      : state.rigs.length < loc.rigSlots ? `${idle} working GPU(s) in inventory but every rig is full. Buy another rig kit.`
        : `${idle} working GPU(s) in inventory but every rig is full and there is no floor space. Sell them or move somewhere bigger.`);
  }
  if (state.parts.some((p) => p.type === 'core')) add('info', 'You have GPU cores. Match memory, PCB and cooler on the Workbench to build a card.');
  const nextLoc = LOCATIONS[LOCATIONS.indexOf(loc) + 1];
  if (nextLoc && state.cash > nextLoc.price * 1.3) add('info', `You can afford the ${nextLoc.name}: more space and ${Math.round((1 - nextLoc.tariffMult) * 100)}% cheaper power.`);
  if (canFork(state)) add('good', 'You can Hard Fork: reset for Fork Shards and permanent upgrades.');
  if (!state.rigs.length && !state.racks.length) add('info', 'Start with a rig kit, a PSU and a GPU, or open a cheap junkyard bin and build your first card.');
  if (!tips.length && room.grossPerDay > 0) add('good', 'All systems healthy.');
  const order = { critical: 0, warning: 1, info: 2, good: 3 };
  return tips.sort((a, b) => order[a.level] - order[b.level]);
}

// ------------------------------------------------------------------ save / load / totals

export function serialize(state) {
  return JSON.stringify(state);
}
export function deserialize(text) {
  const state = JSON.parse(text);
  if (state?.version === 2) migrateV2(state);
  if (!state || state.version !== SAVE_VERSION) throw new Error('Incompatible save');
  return state;
}

/** v2 saves (before risers and boot drives): give existing rigs basic risers and a flash drive. */
function migrateV2(state) {
  for (const rig of state.rigs) {
    rig.risers = rig.risers || Array.from({ length: byId[rig.frameId].slots }, () => makeOwned(state, 'riser009s', 'new', 1));
    rig.boot = rig.boot === undefined ? makeOwned(state, 'usb16', 'new', 1) : rig.boot;
    rig.os = rig.os || 'linux';
  }
  state.dust = state.dust || 0;
  state.facility = state.facility || {};
  state.tariffPlan = state.tariffPlan || 'standard';
  state.version = 3;
}

export function allOwned(state) {
  return [
    ...state.inventory, ...state.cooling,
    ...state.energy.solar, ...state.energy.inverters, ...state.energy.batteries, ...state.energy.generators,
    ...state.racks, ...state.racks.flatMap((r) => r.asics),
    ...state.rigs.flatMap((r) => [...r.gpus, ...r.psus, ...(r.risers || []).filter((x) => !x.broken), ...(r.boot ? [r.boot] : []), { id: r.frameId, boughtDay: r.boughtDay }]),
  ];
}

export function netWorth(state) {
  return state.cash
    + allOwned(state).reduce((s, o) => s + sellValue(state, o), 0)
    + state.parts.reduce((s, p) => s + partValue(state, p), 0);
}

export { SHED_BLOCKS, ASICS };
