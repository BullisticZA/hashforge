// Quality grades, junkyard lots, GPU parts and prestige upgrades.

// perf: hashrate multiplier. power: power-draw multiplier. fail: failure-rate multiplier.
// price: price multiplier vs new. Golden samples only come from salvage, crafting and lucky listings.
export const QUALITY = {
  scrap:  { name: 'Scrap',         rank: 0, perf: 0.70, power: 1.15, fail: 3.0, price: 0.15, color: '#8b8b8b' },
  used:   { name: 'Used',          rank: 1, perf: 0.92, power: 1.05, fail: 1.6, price: 0.55, color: '#c9a36a' },
  refurb: { name: 'Refurbished',   rank: 2, perf: 0.97, power: 1.02, fail: 1.0, price: 0.75, color: '#7cc4ff' },
  new:    { name: 'New',           rank: 3, perf: 1.00, power: 1.00, fail: 0.5, price: 1.00, color: '#e6edf7' },
  golden: { name: 'Golden Sample', rank: 4, perf: 1.08, power: 0.94, fail: 0.3, price: 1.40, color: '#ffd166' },
};
export const QUALITY_ORDER = ['scrap', 'used', 'refurb', 'new', 'golden'];
export const gradeAt = (rank) => QUALITY_ORDER[Math.max(0, Math.min(QUALITY_ORDER.length - 1, Math.round(rank)))];

// GPU part types. A crafted card needs one of each, matched to the core's model.
export const PART_TYPES = {
  core:   { name: 'GPU Core',          share: 0.45 },   // the die: decides the model
  memory: { name: 'Memory Module Set', share: 0.25 },   // must match memory type and capacity
  pcb:    { name: 'PCB & VRM',          share: 0.20 },  // must match the GPU generation
  cooler: { name: 'Cooler',             share: 0.10 },  // needs enough fans for the card's heat
};
export const CRAFT_FEE = 25;

// Junkyard lots: pay up front, open to see what you got.
// grades: weights for scrap/used/refurb/new/golden before upgrades.
export const JUNK_LOTS = [
  { id: 'binbox', name: 'Bin of Dead Graphics Cards', price: 60, parts: [2, 5], wholeCards: 0.15, newestYear: 2021,
    grades: [60, 30, 9, 1, 0.2], blurb: 'Mostly scrap. Occasionally something worth saving.' },
  { id: 'cafe', name: 'Closed Gaming Café Clearout', price: 280, parts: [4, 8], wholeCards: 0.35, newestYear: 2023,
    grades: [30, 45, 20, 4, 0.6], blurb: 'Used cards and PSUs from a café that shut its doors.' },
  { id: 'farmauction', name: 'Bankrupt Mining Farm Auction', price: 1400, parts: [8, 16], wholeCards: 0.5, newestYear: 2025,
    grades: [15, 45, 30, 9, 1.5], blurb: 'Someone else’s failed farm. Ran hard for years.' },
  { id: 'rma', name: 'Factory RMA Returns Pallet', price: 4200, parts: [10, 20], wholeCards: 0.6, newestYear: 2025,
    grades: [5, 20, 50, 22, 3], blurb: 'Returned stock. Fixable, often nearly new. Best odds of a golden die.' },
];

// Permanent upgrades bought with Fork Shards. Every upgrade levels forever, cost grows each level.
export const UPGRADES = [
  { id: 'firmware',  name: 'Custom Mining Firmware', desc: '+3% hashrate on everything per level', base: 3, growth: 1.45 },
  { id: 'contracts', name: 'Power Purchase Contracts', desc: '-4% electricity tariff per level', base: 4, growth: 1.5 },
  { id: 'haggler',   name: 'Supplier Network',        desc: '-3% hardware prices per level', base: 3, growth: 1.45 },
  { id: 'scavenger', name: 'Scavenger Instinct',      desc: 'Better junkyard grades and more parts per lot', base: 2, growth: 1.4 },
  { id: 'builder',   name: 'Master Builder',          desc: 'Crafted cards gain quality, golden chance up', base: 3, growth: 1.5 },
  { id: 'thermal',   name: 'Thermal Engineering',     desc: '+6% cooling capacity per level', base: 2, growth: 1.4 },
  { id: 'capital',   name: 'Seed Capital',            desc: '+$2,500 starting cash per level', base: 2, growth: 1.35 },
  { id: 'durable',   name: 'Preventive Maintenance',  desc: '-8% wear and failures per level', base: 3, growth: 1.45 },
];
export const upgradeCost = (upgrade, level) => Math.ceil(upgrade.base * upgrade.growth ** level);

// Fork thresholds grow each prestige so there is always a next goal.
export const forkThreshold = (forks) => Math.round(150000 * 3.2 ** forks);
export const forkReward = (netWorth, forks) =>
  Math.max(0, Math.floor(10 * Math.sqrt(netWorth / forkThreshold(forks)) * (1 + 0.25 * forks)));
// Each fork, the network is harder: difficulty starts higher.
export const eraDifficulty = (forks) => 1.12 ** forks;
