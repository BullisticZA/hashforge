// HashForge hardware catalog.
// Product names are used only to identify real hardware. All 3D art is original; no logos are used.
// Hash rates and power figures are approximate, tuned-for-mining values for gameplay, not lab benchmarks.

export const ALGOS = {
  sha256:     { name: 'SHA-256',    coin: 'BTC', coinName: 'Bitcoin',     unit: 'TH/s', basePrice: 95000, revenuePerUnit: 0.060, color: '#f7931a', asicOnly: true },
  scrypt:     { name: 'Scrypt',     coin: 'LTC', coinName: 'Litecoin',    unit: 'GH/s', basePrice: 100,   revenuePerUnit: 1.40,  color: '#9fb4d8', asicOnly: true },
  kheavyhash: { name: 'kHeavyHash', coin: 'KAS', coinName: 'Kaspa',       unit: 'TH/s', basePrice: 0.10,  revenuePerUnit: 0.35,  color: '#49eacb', asicOnly: true },
  kawpow:     { name: 'KawPow',     coin: 'RVN', coinName: 'Ravencoin',   unit: 'MH/s', basePrice: 0.02,  revenuePerUnit: 0.035, color: '#5b8cff' },
  etchash:    { name: 'Etchash',    coin: 'ETC', coinName: 'Ethereum Classic', unit: 'MH/s', basePrice: 25, revenuePerUnit: 0.015, color: '#3ab83a' },
  autolykos:  { name: 'Autolykos2', coin: 'ERG', coinName: 'Ergo',        unit: 'MH/s', basePrice: 1.5,   revenuePerUnit: 0.0063, color: '#ff5e18' },
};
export const GPU_ALGOS = ['kawpow', 'etchash', 'autolykos'];

// hash: MH/s per algorithm. power: tuned watts while mining. tdp: stock board power.
// length (mm) and fans drive the 3D model.
const gpu = (id, name, vendor, gen, price, vram, mem, tdp, power, kawpow, etchash, autolykos, length, fans, year) => ({
  id, name, vendor, gen, price, vram, mem, tdp, power, length, fans, year,
  kind: 'gpu', hash: { kawpow, etchash, autolykos },
});

export const GPUS = [
  // NVIDIA RTX 50
  gpu('rtx5090', 'GeForce RTX 5090', 'nvidia', 'RTX 50', 2400, 32, 'GDDR7', 575, 420, 96, 175, 520, 304, 3, 2025),
  gpu('rtx5080', 'GeForce RTX 5080', 'nvidia', 'RTX 50', 1150, 16, 'GDDR7', 360, 260, 60, 120, 330, 304, 3, 2025),
  gpu('rtx5070ti', 'GeForce RTX 5070 Ti', 'nvidia', 'RTX 50', 820, 16, 'GDDR7', 300, 220, 50, 105, 280, 290, 3, 2025),
  gpu('rtx5070', 'GeForce RTX 5070', 'nvidia', 'RTX 50', 560, 12, 'GDDR7', 250, 180, 38, 80, 215, 250, 2, 2025),
  // NVIDIA RTX 40
  gpu('rtx4090', 'GeForce RTX 4090', 'nvidia', 'RTX 40', 1700, 24, 'GDDR6X', 450, 300, 68, 130, 380, 336, 3, 2022),
  gpu('rtx4080', 'GeForce RTX 4080', 'nvidia', 'RTX 40', 950, 16, 'GDDR6X', 320, 240, 50, 110, 290, 310, 3, 2022),
  gpu('rtx4070ti', 'GeForce RTX 4070 Ti', 'nvidia', 'RTX 40', 680, 12, 'GDDR6X', 285, 200, 40, 82, 230, 300, 3, 2023),
  gpu('rtx4070', 'GeForce RTX 4070', 'nvidia', 'RTX 40', 500, 12, 'GDDR6X', 200, 150, 33, 62, 190, 244, 2, 2023),
  gpu('rtx4060ti', 'GeForce RTX 4060 Ti', 'nvidia', 'RTX 40', 370, 8, 'GDDR6', 160, 120, 26, 32, 110, 244, 2, 2023),
  gpu('rtx4060', 'GeForce RTX 4060', 'nvidia', 'RTX 40', 280, 8, 'GDDR6', 115, 95, 22, 28, 95, 200, 2, 2023),
  // NVIDIA RTX 30
  gpu('rtx3090', 'GeForce RTX 3090', 'nvidia', 'RTX 30', 750, 24, 'GDDR6X', 350, 300, 58, 120, 270, 313, 3, 2020),
  gpu('rtx3080ti', 'GeForce RTX 3080 Ti', 'nvidia', 'RTX 30', 540, 12, 'GDDR6X', 350, 300, 55, 115, 260, 313, 3, 2021),
  gpu('rtx3080', 'GeForce RTX 3080', 'nvidia', 'RTX 30', 420, 10, 'GDDR6X', 320, 230, 47, 98, 240, 300, 3, 2020),
  gpu('rtx3070', 'GeForce RTX 3070', 'nvidia', 'RTX 30', 290, 8, 'GDDR6', 220, 125, 30, 62, 165, 267, 2, 2020),
  gpu('rtx3060ti', 'GeForce RTX 3060 Ti', 'nvidia', 'RTX 30', 250, 8, 'GDDR6', 200, 120, 29, 60, 155, 242, 2, 2020),
  gpu('rtx3060', 'GeForce RTX 3060', 'nvidia', 'RTX 30', 210, 12, 'GDDR6', 170, 115, 24, 49, 125, 242, 2, 2021),
  // NVIDIA RTX 20 / GTX
  gpu('rtx2080ti', 'GeForce RTX 2080 Ti', 'nvidia', 'RTX 20', 280, 11, 'GDDR6', 250, 200, 30, 57, 140, 267, 2, 2018),
  gpu('rtx2070s', 'GeForce RTX 2070 Super', 'nvidia', 'RTX 20', 190, 8, 'GDDR6', 215, 140, 22, 41, 100, 267, 2, 2019),
  gpu('rtx2060s', 'GeForce RTX 2060 Super', 'nvidia', 'RTX 20', 160, 8, 'GDDR6', 175, 125, 19, 40, 95, 229, 2, 2019),
  gpu('gtx1660s', 'GeForce GTX 1660 Super', 'nvidia', 'GTX 16', 130, 6, 'GDDR6', 125, 75, 14, 31, 70, 229, 2, 2019),
  gpu('gtx1080ti', 'GeForce GTX 1080 Ti', 'nvidia', 'GTX 10', 150, 11, 'GDDR5X', 250, 200, 25, 45, 110, 267, 2, 2017),
  gpu('gtx1070', 'GeForce GTX 1070', 'nvidia', 'GTX 10', 90, 8, 'GDDR5', 150, 120, 13, 30, 70, 267, 2, 2016),
  // AMD
  gpu('rx7900xtx', 'Radeon RX 7900 XTX', 'amd', 'RX 7000', 850, 24, 'GDDR6', 355, 300, 52, 95, 300, 287, 3, 2022),
  gpu('rx7900xt', 'Radeon RX 7900 XT', 'amd', 'RX 7000', 650, 20, 'GDDR6', 315, 260, 45, 85, 260, 276, 3, 2022),
  gpu('rx7800xt', 'Radeon RX 7800 XT', 'amd', 'RX 7000', 470, 16, 'GDDR6', 263, 200, 32, 64, 190, 267, 2, 2023),
  gpu('rx6900xt', 'Radeon RX 6900 XT', 'amd', 'RX 6000', 420, 16, 'GDDR6', 300, 160, 34, 64, 200, 267, 3, 2020),
  gpu('rx6800xt', 'Radeon RX 6800 XT', 'amd', 'RX 6000', 380, 16, 'GDDR6', 300, 150, 37, 64, 200, 267, 3, 2020),
  gpu('rx6700xt', 'Radeon RX 6700 XT', 'amd', 'RX 6000', 260, 12, 'GDDR6', 230, 110, 24, 47, 140, 267, 2, 2021),
  gpu('rx6600xt', 'Radeon RX 6600 XT', 'amd', 'RX 6000', 200, 8, 'GDDR6', 160, 70, 16, 32, 95, 240, 2, 2021),
  gpu('rx6600', 'Radeon RX 6600', 'amd', 'RX 6000', 170, 8, 'GDDR6', 132, 60, 15, 32, 85, 190, 1, 2021),
  gpu('rx5700xt', 'Radeon RX 5700 XT', 'amd', 'RX 5000', 140, 8, 'GDDR6', 225, 130, 27, 55, 125, 267, 2, 2019),
  gpu('rx580', 'Radeon RX 580 8GB', 'amd', 'RX 500', 60, 8, 'GDDR5', 185, 120, 13, 31, 60, 241, 2, 2017),
  gpu('rx570', 'Radeon RX 570 8GB', 'amd', 'RX 500', 45, 8, 'GDDR5', 150, 110, 12, 28, 55, 241, 2, 2017),
  // Intel
  gpu('arcb580', 'Arc B580', 'intel', 'Arc B', 260, 12, 'GDDR6', 190, 140, 22, 44, 125, 272, 2, 2024),
  gpu('arca770', 'Arc A770 16GB', 'intel', 'Arc A', 250, 16, 'GDDR6', 225, 160, 20, 40, 120, 272, 2, 2022),
];

// hash: in the algorithm's unit (TH/s or GH/s). ASICs include their own power supply.
const asic = (id, name, maker, algo, hashrate, power, price, year, style) => ({
  id, name, maker, algo, hashrate, power, price, year, style, kind: 'asic',
});

export const ASICS = [
  asic('s21xp', 'Antminer S21 XP', 'Bitmain', 'sha256', 270, 3645, 6800, 2024, 'box'),
  asic('s21pro', 'Antminer S21 Pro', 'Bitmain', 'sha256', 234, 3510, 4500, 2024, 'box'),
  asic('s21', 'Antminer S21', 'Bitmain', 'sha256', 200, 3500, 3200, 2023, 'box'),
  asic('s19xp', 'Antminer S19 XP', 'Bitmain', 'sha256', 141, 3010, 1700, 2022, 'box'),
  asic('s19kpro', 'Antminer S19k Pro', 'Bitmain', 'sha256', 120, 2760, 900, 2023, 'box'),
  asic('s19jpro', 'Antminer S19j Pro', 'Bitmain', 'sha256', 104, 3068, 480, 2021, 'box'),
  asic('s9', 'Antminer S9', 'Bitmain', 'sha256', 13.5, 1323, 60, 2016, 'box'),
  asic('m60s', 'Whatsminer M60S', 'MicroBT', 'sha256', 186, 3441, 3000, 2023, 'tall'),
  asic('m50s', 'Whatsminer M50S', 'MicroBT', 'sha256', 126, 3276, 1100, 2022, 'tall'),
  asic('m30spp', 'Whatsminer M30S++', 'MicroBT', 'sha256', 112, 3472, 700, 2020, 'tall'),
  asic('a1466', 'AvalonMiner A1466', 'Canaan', 'sha256', 150, 3230, 2100, 2023, 'tall'),
  asic('l9', 'Antminer L9', 'Bitmain', 'scrypt', 16, 3360, 10000, 2024, 'box'),
  asic('l7', 'Antminer L7', 'Bitmain', 'scrypt', 9.5, 3425, 3500, 2021, 'box'),
  asic('l3p', 'Antminer L3+', 'Bitmain', 'scrypt', 0.504, 800, 40, 2017, 'box'),
  asic('ks5pro', 'Antminer KS5 Pro', 'Bitmain', 'kheavyhash', 21, 3150, 4000, 2024, 'box'),
  asic('ks3', 'Antminer KS3', 'Bitmain', 'kheavyhash', 9.4, 3500, 900, 2023, 'box'),
  asic('ks3m', 'IceRiver KS3M', 'IceRiver', 'kheavyhash', 6, 3400, 900, 2023, 'box'),
  asic('ks0pro', 'IceRiver KS0 Pro', 'IceRiver', 'kheavyhash', 0.2, 100, 250, 2023, 'mini'),
  asic('x16q', 'Jasminer X16-Q', 'Jasminer', 'etchash', 1950, 620, 2800, 2023, 'quiet'),
];

// Power supplies for GPU rigs. efficiency = AC->DC at typical mining load.
export const PSUS = [
  { id: 'psu650b', name: '650 W 80 Plus Bronze', watts: 650, efficiency: 0.85, rating: 'Bronze', price: 60, kind: 'psu' },
  { id: 'psu850g', name: '850 W 80 Plus Gold', watts: 850, efficiency: 0.90, rating: 'Gold', price: 100, kind: 'psu' },
  { id: 'psu1000g', name: '1000 W 80 Plus Gold', watts: 1000, efficiency: 0.90, rating: 'Gold', price: 130, kind: 'psu' },
  { id: 'psu1300g', name: '1300 W 80 Plus Gold', watts: 1300, efficiency: 0.90, rating: 'Gold', price: 190, kind: 'psu' },
  { id: 'srv1200p', name: '1200 W Server PSU + breakout board', watts: 1200, efficiency: 0.92, rating: 'Platinum', price: 55, kind: 'psu', noisy: true },
  { id: 'psu1600p', name: '1600 W 80 Plus Platinum', watts: 1600, efficiency: 0.92, rating: 'Platinum', price: 340, kind: 'psu' },
  { id: 'psu2000t', name: '2000 W 80 Plus Titanium', watts: 2000, efficiency: 0.94, rating: 'Titanium', price: 520, kind: 'psu' },
];

// Open-air frames come as a kit with motherboard, CPU, RAM, SSD and risers.
export const FRAMES = [
  { id: 'frame4', name: '4-GPU Open-Air Rig Kit', slots: 4, psuSlots: 1, basePower: 60, price: 220, kind: 'frame' },
  { id: 'frame6', name: '6-GPU Open-Air Rig Kit', slots: 6, psuSlots: 2, basePower: 70, price: 320, kind: 'frame' },
  { id: 'frame8', name: '8-GPU Open-Air Rig Kit', slots: 8, psuSlots: 2, basePower: 80, price: 450, kind: 'frame' },
  { id: 'frame12', name: '12-GPU Mining Server Chassis', slots: 12, psuSlots: 2, basePower: 110, price: 760, kind: 'frame' },
];

// cooling: watts of heat removed. power: watts the unit itself draws.
export const COOLING = [
  { id: 'boxfan', name: 'Box Fan', cooling: 1500, power: 50, price: 40, kind: 'cooling', style: 'fan' },
  { id: 'exhaust', name: 'Window Exhaust Fan', cooling: 3000, power: 120, price: 180, kind: 'cooling', style: 'fan' },
  { id: 'windowac', name: 'Window Air Conditioner', cooling: 2500, power: 850, price: 320, kind: 'cooling', style: 'ac' },
  { id: 'portac', name: 'Portable Air Conditioner', cooling: 3500, power: 1100, price: 450, kind: 'cooling', style: 'ac' },
  { id: 'splitac', name: 'Split-Unit Air Conditioner', cooling: 7000, power: 2000, price: 1200, kind: 'cooling', style: 'ac' },
  { id: 'evap', name: 'Evaporative Cooler', cooling: 6000, power: 250, price: 700, kind: 'cooling', style: 'evap', humid: true },
  { id: 'industrial', name: 'Industrial Exhaust Wall', cooling: 15000, power: 900, price: 2600, kind: 'cooling', style: 'wall' },
  { id: 'crac', name: 'Precision CRAC Unit (Data Centre AC)', cooling: 45000, power: 9000, price: 22000, kind: 'cooling', style: 'crac' },
  { id: 'immersion', name: 'Immersion Cooling Tank', cooling: 30000, power: 1500, price: 9000, kind: 'cooling', style: 'tank' },
];

// Racks hold ASIC miners. Each rack's PDU (power strip) has a limit: overload it and the rack trips.
export const RACKS = [
  { id: 'shelf', name: 'Steel Wire Shelf', units: 2, pduKw: 4, price: 90, kind: 'rack', style: 'shelf' },
  { id: 'openrack', name: 'Open-Frame Mining Rack', units: 4, pduKw: 15, price: 380, kind: 'rack', style: 'open' },
  { id: 'rack42u', name: '42U Server Rack + 3-Phase PDU', units: 8, pduKw: 30, price: 1600, kind: 'rack', style: 'cabinet' },
];

// Off-grid power. Nothing from solar or batteries reaches the miners without an inverter,
// and an inverter can only deliver its rated kW: ask for more and it trips.
export const INVERTERS = [
  { id: 'inv3', name: '3 kW Hybrid Inverter', kw: 3, efficiency: 0.94, price: 650, kind: 'inverter' },
  { id: 'inv8', name: '8 kW Hybrid Inverter', kw: 8, efficiency: 0.95, price: 1500, kind: 'inverter' },
  { id: 'inv16', name: '16 kW Hybrid Inverter', kw: 16, efficiency: 0.96, price: 3200, kind: 'inverter' },
  { id: 'inv50', name: '50 kW Three-Phase Inverter', kw: 50, efficiency: 0.97, price: 9500, kind: 'inverter' },
];
// cycles: full charge cycles until the battery is worn to 70% capacity.
export const BATTERIES = [
  { id: 'lead5', name: '5 kWh Lead-Acid Bank', kwh: 5, maxKw: 2, efficiency: 0.8, cycles: 500, price: 900, kind: 'battery' },
  { id: 'lfp5', name: '5 kWh LiFePO4 Battery', kwh: 5, maxKw: 5, efficiency: 0.92, cycles: 4000, price: 1500, kind: 'battery' },
  { id: 'lfp15', name: '15 kWh LiFePO4 Stack', kwh: 15, maxKw: 10, efficiency: 0.93, cycles: 6000, price: 4000, kind: 'battery' },
  { id: 'bess100', name: '100 kWh Containerised Battery', kwh: 100, maxKw: 50, efficiency: 0.94, cycles: 6000, price: 24000, kind: 'battery' },
];
// kwp: peak output in full sun. Real output follows the sun, the season and the weather.
export const SOLAR = [
  { id: 'panel4', name: '4 x 550 W Solar Panels', kwp: 2.2, price: 900, kind: 'solar' },
  { id: 'array10', name: '10 kWp Rooftop Array', kwp: 10, price: 3800, kind: 'solar' },
  { id: 'array50', name: '50 kWp Ground-Mount Array', kwp: 50, price: 17000, kind: 'solar' },
];
export const GENERATORS = [
  { id: 'generator', name: '20 kW Diesel Generator', kw: 20, litresPerKwh: 0.3, price: 3500, kind: 'generator' },
];

// Regions set the currency, the home electricity tariff (in local currency per kWh) and the grid's habits.
// Tariffs are typical residential figures and can be edited in Settings - every utility differs.
// fx: fallback USD -> local rate used until a live rate is fetched.
export const REGIONS = [
  { id: 'za', name: 'South Africa', currency: 'ZAR', symbol: 'R', locale: 'en-ZA', fx: 18.2, tariff: 3.80, loadShedding: true, outageRate: 0.004 },
  { id: 'us', name: 'United States', currency: 'USD', symbol: '$', locale: 'en-US', fx: 1, tariff: 0.17, loadShedding: false, outageRate: 0.01 },
  { id: 'gb', name: 'United Kingdom', currency: 'GBP', symbol: '£', locale: 'en-GB', fx: 0.79, tariff: 0.25, loadShedding: false, outageRate: 0.006 },
  { id: 'eu', name: 'Eurozone', currency: 'EUR', symbol: '€', locale: 'de-DE', fx: 0.92, tariff: 0.28, loadShedding: false, outageRate: 0.006 },
  { id: 'au', name: 'Australia', currency: 'AUD', symbol: 'A$', locale: 'en-AU', fx: 1.52, tariff: 0.32, loadShedding: false, outageRate: 0.008 },
];

// Locations: space, circuit size and how much cheaper than home power they are (tariffMult).
export const LOCATIONS = [
  { id: 'bedroom', serverSlots: 2, name: 'Bedroom Corner', rigSlots: 2, rackSlots: 1, coolingSlots: 2, roofKwp: 4.4, circuitKw: 3.6, tariffMult: 1.0, ambient: 24, roomSize: 1, price: 0, w: 10, d: 8 },
  { id: 'garage', serverSlots: 6, name: 'Double Garage', rigSlots: 6, rackSlots: 2, coolingSlots: 3, roofKwp: 12, circuitKw: 15, tariffMult: 0.9, ambient: 26, roomSize: 2.2, price: 6000, w: 16, d: 12 },
  { id: 'warehouse', serverSlots: 16, name: 'Industrial Warehouse', rigSlots: 16, rackSlots: 6, coolingSlots: 6, roofKwp: 100, circuitKw: 120, tariffMult: 0.6, ambient: 22, roomSize: 6, price: 45000, w: 30, d: 20 },
  { id: 'hydro', serverSlots: 40, name: 'Hydro-Powered Mining Hall', rigSlots: 30, rackSlots: 14, coolingSlots: 10, roofKwp: 200, circuitKw: 500, tariffMult: 0.25, ambient: 12, roomSize: 14, price: 250000, w: 44, d: 28 },
];

// PCIe risers: every rig kit ships with basic 009S risers (Molex / 6-pin powered).
// SATA-powered risers are cheap but a SATA connector is rated far below what a card can pull through the slot - a fire risk.
export const RISERS = [
  { id: 'riser009s', name: 'PCIe Riser 009S (6-pin/Molex)', power: '6-pin', reliability: 1, fireRisk: 0, price: 6, kind: 'riser' },
  { id: 'riser009sata', name: 'PCIe Riser 009S (SATA-powered)', power: 'SATA', reliability: 1.3, fireRisk: 1, price: 3, kind: 'riser' },
  { id: 'riser011pro', name: 'PCIe Riser 011 Pro (shielded, 6-pin)', power: '6-pin', reliability: 0.3, fireRisk: 0, price: 14, kind: 'riser' },
];
// Boot media: a rig won't mine without one. Flash drives are cheap but wear out fastest.
export const BOOT = [
  { id: 'usb16', name: '16 GB USB 3.0 Flash Drive', gb: 16, reliability: 2, price: 8, kind: 'boot', style: 'usb' },
  { id: 'ssd120', name: '120 GB SATA SSD', gb: 120, reliability: 0.7, price: 22, kind: 'boot', style: 'ssd' },
  { id: 'nvme256', name: '256 GB M.2 NVMe SSD', gb: 256, reliability: 0.4, price: 35, kind: 'boot', style: 'nvme' },
];
// Workbench consumables for GPUs.
export const MODS = [
  { id: 'pads', name: 'Thermal Pad Kit (12.8 W/mK)', desc: 'Re-pad the memory. GDDR6X cards stop throttling on memory heat; all cards wear slower.', price: 30, kind: 'mod' },
  { id: 'shim', name: 'Copper Shim Kit', desc: 'Copper shims on the memory: +3% hashrate on top of fresh pads, even less wear.', price: 15, kind: 'mod', needs: 'pads' },
];
export const OS = {
  linux: { name: 'Linux mining OS', licence: 0, overheadW: 0, maxGpus: 16, hashBonus: 0, desc: 'Free and lean. Built for big rigs.' },
  windows: { name: 'Windows 11 Pro', licence: 139, overheadW: 35, maxGpus: 8, hashBonus: 0.03, desc: 'Licence and overhead, max 8 GPUs, but overclock tools: +3% on NVIDIA cards.' },
};
// Facility upgrades (per location), priced by room size.
export const FACILITY = [
  { id: 'containment', name: 'Hot/Cold Aisle Containment', desc: 'Foam and sheet-metal barriers stop hot exhaust looping back: +25% cooling effectiveness.', price: 400 },
  { id: 'filters', name: 'Intake Dust Filters', desc: 'Pleated filters on the intakes: dust builds up 60% slower.', price: 150 },
];


// ------------------------------------------------------------------ expansion: the rest of the line-ups
// gpu(id, name, vendor, gen, price, vram, mem, tdp, power, kawpow, etchash, autolykos, length, fans, year, extra)
const gpuX = (...a) => Object.assign(gpu(...a.slice(0, 15)), a[15] || {});
GPUS.push(
  // NVIDIA current and recent
  gpuX('rtx5060ti', 'GeForce RTX 5060 Ti 16GB', 'nvidia', 'RTX 50', 420, 16, 'GDDR7', 180, 140, 30, 60, 160, 240, 2, 2025),
  gpuX('rtx5060', 'GeForce RTX 5060', 'nvidia', 'RTX 50', 300, 8, 'GDDR7', 145, 115, 26, 58, 140, 220, 2, 2025),
  gpuX('rtx4080s', 'GeForce RTX 4080 Super', 'nvidia', 'RTX 40', 980, 16, 'GDDR6X', 320, 245, 52, 112, 300, 310, 3, 2024),
  gpuX('rtx4070tis', 'GeForce RTX 4070 Ti Super', 'nvidia', 'RTX 40', 780, 16, 'GDDR6X', 285, 220, 44, 95, 260, 300, 3, 2024),
  gpuX('rtx4070s', 'GeForce RTX 4070 Super', 'nvidia', 'RTX 40', 580, 12, 'GDDR6X', 220, 160, 36, 70, 210, 267, 2, 2024),
  gpuX('rtx3090ti', 'GeForce RTX 3090 Ti', 'nvidia', 'RTX 30', 850, 24, 'GDDR6X', 450, 330, 62, 125, 280, 336, 3, 2022),
  gpuX('rtx3070ti', 'GeForce RTX 3070 Ti', 'nvidia', 'RTX 30', 330, 8, 'GDDR6X', 290, 210, 34, 80, 180, 267, 2, 2021),
  gpuX('rtx3050', 'GeForce RTX 3050 8GB', 'nvidia', 'RTX 30', 170, 8, 'GDDR6', 130, 90, 15, 30, 75, 200, 2, 2022),
  gpuX('rtx2080s', 'GeForce RTX 2080 Super', 'nvidia', 'RTX 20', 220, 8, 'GDDR6', 250, 180, 28, 42, 110, 267, 2, 2019),
  gpuX('rtx2080', 'GeForce RTX 2080', 'nvidia', 'RTX 20', 200, 8, 'GDDR6', 215, 170, 27, 40, 105, 267, 2, 2018),
  gpuX('rtx2070', 'GeForce RTX 2070', 'nvidia', 'RTX 20', 170, 8, 'GDDR6', 175, 135, 21, 38, 95, 229, 2, 2018),
  gpuX('rtx2060', 'GeForce RTX 2060 6GB', 'nvidia', 'RTX 20', 130, 6, 'GDDR6', 160, 115, 17, 30, 80, 229, 2, 2019),
  gpuX('gtx1660ti', 'GeForce GTX 1660 Ti', 'nvidia', 'GTX 16', 125, 6, 'GDDR6', 120, 80, 14, 31, 72, 229, 2, 2019),
  gpuX('gtx1660', 'GeForce GTX 1660', 'nvidia', 'GTX 16', 100, 6, 'GDDR5', 120, 85, 12, 26, 60, 229, 2, 2019),
  gpuX('gtx1650s', 'GeForce GTX 1650 Super', 'nvidia', 'GTX 16', 90, 4, 'GDDR6', 100, 70, 10, 21, 52, 200, 1, 2019),
  gpuX('gtx1080', 'GeForce GTX 1080', 'nvidia', 'GTX 10', 120, 8, 'GDDR5X', 180, 160, 21, 34, 85, 267, 2, 2016),
  gpuX('gtx1070ti', 'GeForce GTX 1070 Ti', 'nvidia', 'GTX 10', 100, 8, 'GDDR5', 180, 140, 15, 31, 75, 267, 2, 2017),
  gpuX('gtx1060', 'GeForce GTX 1060 6GB', 'nvidia', 'GTX 10', 60, 6, 'GDDR5', 120, 100, 10, 22, 50, 229, 2, 2016),
  gpuX('gtx1050ti', 'GeForce GTX 1050 Ti', 'nvidia', 'GTX 10', 45, 4, 'GDDR5', 75, 65, 6, 13, 30, 190, 1, 2016),
  gpuX('titanrtx', 'TITAN RTX', 'nvidia', 'RTX 20', 600, 24, 'GDDR6', 280, 230, 34, 60, 150, 267, 2, 2018),
  gpuX('titanv', 'TITAN V', 'nvidia', 'Volta', 700, 12, 'HBM2', 250, 200, 38, 80, 160, 267, 1, 2017, { blower: true }),
  // NVIDIA mining cards: no display outputs
  gpuX('cmp30hx', 'CMP 30HX', 'nvidia', 'CMP', 90, 6, 'GDDR6', 125, 110, 15, 26, 60, 229, 2, 2021, { headless: true }),
  gpuX('cmp40hx', 'CMP 40HX', 'nvidia', 'CMP', 150, 8, 'GDDR6', 185, 165, 20, 36, 85, 229, 2, 2021, { headless: true }),
  gpuX('cmp50hx', 'CMP 50HX', 'nvidia', 'CMP', 200, 10, 'GDDR6', 250, 220, 26, 45, 110, 267, 2, 2021, { headless: true }),
  gpuX('cmp90hx', 'CMP 90HX', 'nvidia', 'CMP', 300, 10, 'GDDR6X', 320, 250, 40, 86, 200, 285, 2, 2021, { headless: true }),
  gpuX('cmp170hx', 'CMP 170HX', 'nvidia', 'CMP', 900, 8, 'HBM2e', 250, 240, 46, 164, 180, 267, 0, 2021, { headless: true, passive: true }),
  gpuX('p106', 'P106-100 6GB', 'nvidia', 'Pascal mining', 40, 6, 'GDDR5', 120, 90, 10, 21, 45, 229, 2, 2017, { headless: true }),
  gpuX('p104', 'P104-100 8GB', 'nvidia', 'Pascal mining', 60, 8, 'GDDR5X', 180, 120, 15, 37, 75, 229, 2, 2018, { headless: true }),
  // Workstation and data centre
  gpuX('a4000', 'RTX A4000', 'nvidia', 'Ampere Pro', 550, 16, 'GDDR6', 140, 140, 26, 60, 150, 241, 1, 2021, { blower: true }),
  gpuX('a5000', 'RTX A5000', 'nvidia', 'Ampere Pro', 1100, 24, 'GDDR6', 230, 230, 40, 98, 220, 267, 1, 2021, { blower: true }),
  gpuX('a100', 'A100 40GB PCIe', 'nvidia', 'Data centre', 6000, 40, 'HBM2', 250, 250, 56, 170, 400, 267, 0, 2020, { headless: true, passive: true }),
  // AMD
  gpuX('rx9070xt', 'Radeon RX 9070 XT', 'amd', 'RX 9000', 650, 16, 'GDDR6', 304, 250, 40, 80, 230, 300, 3, 2025),
  gpuX('rx9070', 'Radeon RX 9070', 'amd', 'RX 9000', 570, 16, 'GDDR6', 220, 200, 36, 75, 210, 280, 3, 2025),
  gpuX('rx9060xt', 'Radeon RX 9060 XT 16GB', 'amd', 'RX 9000', 360, 16, 'GDDR6', 160, 140, 22, 42, 120, 240, 2, 2025),
  gpuX('rx7900gre', 'Radeon RX 7900 GRE', 'amd', 'RX 7000', 560, 16, 'GDDR6', 260, 220, 40, 70, 230, 276, 3, 2023),
  gpuX('rx7700xt', 'Radeon RX 7700 XT', 'amd', 'RX 7000', 400, 12, 'GDDR6', 245, 180, 27, 52, 160, 267, 2, 2023),
  gpuX('rx7600', 'Radeon RX 7600', 'amd', 'RX 7000', 260, 8, 'GDDR6', 165, 130, 18, 30, 95, 204, 2, 2023),
  gpuX('rx6950xt', 'Radeon RX 6950 XT', 'amd', 'RX 6000', 470, 16, 'GDDR6', 335, 170, 38, 64, 210, 267, 3, 2022),
  gpuX('rx6800', 'Radeon RX 6800', 'amd', 'RX 6000', 340, 16, 'GDDR6', 250, 140, 34, 62, 190, 267, 2, 2020),
  gpuX('rx6750xt', 'Radeon RX 6750 XT', 'amd', 'RX 6000', 280, 12, 'GDDR6', 250, 115, 25, 47, 145, 267, 2, 2022),
  gpuX('rx6650xt', 'Radeon RX 6650 XT', 'amd', 'RX 6000', 210, 8, 'GDDR6', 180, 75, 17, 32, 96, 240, 2, 2022),
  gpuX('rx5700', 'Radeon RX 5700', 'amd', 'RX 5000', 120, 8, 'GDDR6', 180, 120, 25, 52, 120, 267, 2, 2019),
  gpuX('rx5600xt', 'Radeon RX 5600 XT', 'amd', 'RX 5000', 100, 6, 'GDDR6', 150, 110, 20, 40, 95, 240, 2, 2020),
  gpuX('rx5500xt', 'Radeon RX 5500 XT 8GB', 'amd', 'RX 5000', 70, 8, 'GDDR6', 130, 110, 12, 27, 55, 220, 2, 2019),
  gpuX('radeon7', 'Radeon VII', 'amd', 'Vega', 250, 16, 'HBM2', 300, 200, 30, 90, 210, 268, 3, 2019),
  gpuX('vega64', 'Radeon RX Vega 64', 'amd', 'Vega', 120, 8, 'HBM2', 295, 180, 22, 44, 130, 267, 1, 2017, { blower: true }),
  gpuX('vega56', 'Radeon RX Vega 56', 'amd', 'Vega', 100, 8, 'HBM2', 210, 160, 20, 40, 120, 267, 1, 2017, { blower: true }),
  gpuX('rx590', 'Radeon RX 590', 'amd', 'RX 500', 55, 8, 'GDDR5', 225, 130, 14, 30, 62, 241, 2, 2018),
  gpuX('rx480', 'Radeon RX 480 8GB', 'amd', 'RX 400', 45, 8, 'GDDR5', 150, 120, 12, 29, 56, 241, 2, 2016),
  gpuX('rx470', 'Radeon RX 470 8GB', 'amd', 'RX 400', 40, 8, 'GDDR5', 120, 110, 11, 27, 52, 241, 2, 2016),
  gpuX('mi50', 'Instinct MI50 32GB', 'amd', 'Data centre', 350, 32, 'HBM2', 300, 200, 32, 90, 200, 267, 0, 2018, { headless: true, passive: true }),
  gpuX('w6800', 'Radeon Pro W6800', 'amd', 'Pro', 900, 32, 'GDDR6', 250, 180, 34, 64, 190, 267, 1, 2021, { blower: true }),
  // Intel
  gpuX('arcb570', 'Arc B570', 'intel', 'Arc B', 220, 10, 'GDDR6', 150, 125, 19, 38, 108, 250, 2, 2025),
  gpuX('arca750', 'Arc A750', 'intel', 'Arc A', 180, 8, 'GDDR6', 225, 150, 18, 36, 105, 272, 2, 2022),
  gpuX('arca580', 'Arc A580', 'intel', 'Arc A', 150, 8, 'GDDR6', 185, 140, 15, 30, 90, 250, 2, 2023),
  gpuX('arca380', 'Arc A380', 'intel', 'Arc A', 110, 6, 'GDDR6', 75, 60, 6, 13, 35, 190, 1, 2022),
);

ASICS.push(
  // SHA-256: new generation, hydro and immersion
  asic('s21plus', 'Antminer S21+', 'Bitmain', 'sha256', 216, 3564, 3800, 2025, 'box'),
  asic('s21hyd', 'Antminer S21 Hydro', 'Bitmain', 'sha256', 335, 5360, 7000, 2024, 'hydro'),
  asic('t21', 'Antminer T21', 'Bitmain', 'sha256', 190, 3610, 2800, 2024, 'box'),
  asic('s19xphyd', 'Antminer S19 XP Hydro', 'Bitmain', 'sha256', 255, 5304, 4000, 2022, 'hydro'),
  asic('s19jproplus', 'Antminer S19j Pro+', 'Bitmain', 'sha256', 122, 3355, 700, 2022, 'box'),
  asic('s19pro', 'Antminer S19 Pro', 'Bitmain', 'sha256', 110, 3250, 550, 2020, 'box'),
  asic('s19', 'Antminer S19', 'Bitmain', 'sha256', 95, 3250, 350, 2020, 'box'),
  asic('t19', 'Antminer T19', 'Bitmain', 'sha256', 84, 3150, 250, 2020, 'box'),
  asic('s17plus', 'Antminer S17+', 'Bitmain', 'sha256', 73, 2920, 180, 2019, 'box'),
  asic('s17pro', 'Antminer S17 Pro', 'Bitmain', 'sha256', 53, 2094, 150, 2019, 'box'),
  asic('s9se', 'Antminer S9 SE', 'Bitmain', 'sha256', 16, 1280, 90, 2018, 'box'),
  asic('s9j', 'Antminer S9j', 'Bitmain', 'sha256', 14.5, 1350, 70, 2018, 'box'),
  asic('m66s', 'Whatsminer M66S', 'MicroBT', 'sha256', 298, 5513, 6500, 2024, 'hydro'),
  asic('m63s', 'Whatsminer M63S', 'MicroBT', 'sha256', 390, 7215, 9000, 2024, 'hydro'),
  asic('m60', 'Whatsminer M60', 'MicroBT', 'sha256', 172, 3422, 2600, 2023, 'tall'),
  asic('m56s', 'Whatsminer M56S', 'MicroBT', 'sha256', 212, 5550, 3500, 2023, 'hydro'),
  asic('m50', 'Whatsminer M50', 'MicroBT', 'sha256', 114, 3306, 900, 2022, 'tall'),
  asic('m31splus', 'Whatsminer M31S+', 'MicroBT', 'sha256', 82, 3280, 250, 2020, 'tall'),
  asic('m21s', 'Whatsminer M21S', 'MicroBT', 'sha256', 56, 3360, 120, 2019, 'tall'),
  asic('m20s', 'Whatsminer M20S', 'MicroBT', 'sha256', 68, 3360, 150, 2019, 'tall'),
  asic('a1566', 'AvalonMiner A1566', 'Canaan', 'sha256', 185, 3420, 2800, 2024, 'tall'),
  asic('a1366', 'AvalonMiner A1366', 'Canaan', 'sha256', 130, 3250, 1300, 2023, 'tall'),
  asic('a1246', 'AvalonMiner A1246', 'Canaan', 'sha256', 90, 3420, 450, 2021, 'tall'),
  asic('avmini3', 'Avalon Mini 3 (space heater)', 'Canaan', 'sha256', 37.5, 800, 900, 2024, 'heater'),
  asic('avnano3', 'Avalon Nano 3 (desk heater)', 'Canaan', 'sha256', 4, 140, 180, 2024, 'heater'),
  asic('bitaxe', 'Bitaxe Gamma (open-source)', 'Open hardware', 'sha256', 1.2, 18, 120, 2024, 'tiny'),
  asic('nerdqaxe', 'NerdQaxe++ (open-source)', 'Open hardware', 'sha256', 4.8, 76, 350, 2025, 'tiny'),
  // Scrypt
  asic('l3pp', 'Antminer L3++', 'Bitmain', 'scrypt', 0.58, 942, 50, 2018, 'box'),
  asic('dgmax', 'Goldshell DG Max', 'Goldshell', 'scrypt', 6.5, 3300, 3000, 2023, 'box'),
  asic('minidoge3', 'Goldshell Mini-DOGE III', 'Goldshell', 'scrypt', 0.7, 400, 350, 2023, 'mini'),
  asic('dg1plus', 'Elphapex DG1+', 'Elphapex', 'scrypt', 14, 3950, 6000, 2024, 'box'),
  asic('volcd1', 'VolcMiner D1', 'VolcMiner', 'scrypt', 15.15, 3900, 7000, 2024, 'box'),
  // kHeavyHash
  asic('ks5l', 'IceRiver KS5L', 'IceRiver', 'kheavyhash', 12, 3400, 1500, 2024, 'box'),
  asic('ks3l', 'IceRiver KS3L', 'IceRiver', 'kheavyhash', 5, 3200, 700, 2023, 'box'),
  asic('ks2', 'IceRiver KS2', 'IceRiver', 'kheavyhash', 2, 1200, 500, 2023, 'mini'),
  asic('ks1', 'IceRiver KS1', 'IceRiver', 'kheavyhash', 1, 600, 300, 2023, 'mini'),
  asic('ks5', 'Antminer KS5', 'Bitmain', 'kheavyhash', 20, 3000, 3500, 2024, 'box'),
  asic('kaboxpro', 'Goldshell KA Box Pro', 'Goldshell', 'kheavyhash', 1.6, 400, 400, 2023, 'mini'),
  asic('eka1m', 'Goldshell E-KA1M', 'Goldshell', 'kheavyhash', 5.5, 1800, 1200, 2023, 'box'),
  // Etchash
  asic('x16p', 'Jasminer X16-P', 'Jasminer', 'etchash', 5800, 1900, 5500, 2024, 'quiet'),
  asic('x4q', 'Jasminer X4-Q', 'Jasminer', 'etchash', 1040, 480, 1500, 2022, 'quiet'),
  asic('e9pro', 'Antminer E9 Pro', 'Bitmain', 'etchash', 3680, 2200, 4000, 2022, 'box'),
  asic('a11pro', 'Innosilicon A11 Pro', 'Innosilicon', 'etchash', 2000, 2500, 1500, 2021, 'box'),
);

PSUS.push(
  { id: 'psu750b', name: '750 W 80 Plus Bronze', watts: 750, efficiency: 0.85, rating: 'Bronze', price: 70, kind: 'psu' },
  { id: 'psu1200g', name: '1200 W 80 Plus Gold', watts: 1200, efficiency: 0.90, rating: 'Gold', price: 170, kind: 'psu' },
  { id: 'psu1500p', name: '1500 W 80 Plus Platinum', watts: 1500, efficiency: 0.92, rating: 'Platinum', price: 300, kind: 'psu' },
  { id: 'psu1600t', name: '1600 W 80 Plus Titanium', watts: 1600, efficiency: 0.94, rating: 'Titanium', price: 420, kind: 'psu' },
  { id: 'mine1800', name: '1800 W Mining PSU (multi-rail)', watts: 1800, efficiency: 0.88, rating: 'Gold', price: 120, kind: 'psu', noisy: true },
  { id: 'srv750g', name: '750 W Server PSU + breakout board', watts: 750, efficiency: 0.9, rating: 'Gold', price: 35, kind: 'psu', noisy: true },
  { id: 'srv2400p', name: '2400 W Server PSU + breakout board', watts: 2400, efficiency: 0.93, rating: 'Platinum', price: 140, kind: 'psu', noisy: true },
);

FRAMES.push(
  { id: 'frame8s', name: '8-GPU Stackable Aluminium Frame Kit', slots: 8, psuSlots: 2, basePower: 80, price: 390, kind: 'frame' },
  { id: 'frame6c', name: '6-GPU Closed Server Case (fans, dust filter)', slots: 6, psuSlots: 1, basePower: 110, price: 420, kind: 'frame' },
  { id: 'frame9c', name: '9-GPU Mining Server Case (Octominer-style)', slots: 9, psuSlots: 2, basePower: 130, price: 620, kind: 'frame' },
  { id: 'frame19', name: '19-GPU Mega Rig Kit', slots: 19, psuSlots: 3, basePower: 150, price: 1100, kind: 'frame' },
);

COOLING.push(
  { id: 'towerfan', name: 'Tower Fan', cooling: 1000, power: 45, price: 35, kind: 'cooling', style: 'fan' },
  { id: 'inline', name: 'Inline Duct Fan (8-inch)', cooling: 2200, power: 110, price: 140, kind: 'cooling', style: 'fan' },
  { id: 'roofex', name: 'Roof Extractor Fan', cooling: 9000, power: 600, price: 1800, kind: 'cooling', style: 'wall' },
  { id: 'evaptower', name: 'Industrial Evaporative Tower', cooling: 20000, power: 900, price: 5200, kind: 'cooling', style: 'evap', humid: true },
  { id: 'chiller', name: 'Water Chiller (for hydro miners)', cooling: 40000, power: 7000, price: 18000, kind: 'cooling', style: 'crac' },
  { id: 'dryimmersion', name: 'Two-Phase Immersion Tank', cooling: 60000, power: 2500, price: 26000, kind: 'cooling', style: 'tank' },
);

RACKS.push(
  { id: 'stackshelf', name: 'Stackable ASIC Shelving', units: 3, pduKw: 10, price: 220, kind: 'rack', style: 'shelf' },
  { id: 'rack24u', name: '24U Rack + Smart PDU', units: 5, pduKw: 20, price: 900, kind: 'rack', style: 'cabinet' },
  { id: 'rackhd', name: 'High-Density Mining Rack', units: 12, pduKw: 45, price: 2600, kind: 'rack', style: 'open' },
  { id: 'container', name: '20 ft Mining Container Pod', units: 16, pduKw: 70, price: 22000, kind: 'rack', style: 'cabinet' },
);

INVERTERS.push(
  { id: 'inv5', name: '5 kW Hybrid Inverter', kw: 5, efficiency: 0.95, price: 1000, kind: 'inverter' },
  { id: 'inv12', name: '12 kW Hybrid Inverter', kw: 12, efficiency: 0.96, price: 2400, kind: 'inverter' },
  { id: 'inv30', name: '30 kW Three-Phase Inverter', kw: 30, efficiency: 0.97, price: 6000, kind: 'inverter' },
  { id: 'inv100', name: '100 kW Commercial Inverter', kw: 100, efficiency: 0.975, price: 17000, kind: 'inverter' },
);
BATTERIES.push(
  { id: 'lead10', name: '10 kWh Lead-Acid Bank', kwh: 10, maxKw: 3, efficiency: 0.8, cycles: 600, price: 1700, kind: 'battery' },
  { id: 'lfp10w', name: '10 kWh LiFePO4 Wall Battery', kwh: 10, maxKw: 7, efficiency: 0.93, cycles: 6000, price: 2800, kind: 'battery' },
  { id: 'lfp30', name: '30 kWh LiFePO4 Rack Stack', kwh: 30, maxKw: 20, efficiency: 0.93, cycles: 6000, price: 7800, kind: 'battery' },
  { id: 'bess250', name: '250 kWh Battery Container', kwh: 250, maxKw: 125, efficiency: 0.95, cycles: 7000, price: 55000, kind: 'battery' },
);
SOLAR.push(
  { id: 'panel6', name: '6 x 550 W Solar Panels', kwp: 3.3, price: 1300, kind: 'solar' },
  { id: 'array20', name: '20 kWp Rooftop Array', kwp: 20, price: 7200, kind: 'solar' },
  { id: 'array100', name: '100 kWp Solar Field', kwp: 100, price: 32000, kind: 'solar' },
  { id: 'array200', name: '200 kWp Solar Farm', kwp: 200, price: 60000, kind: 'solar' },
);
GENERATORS.push(
  { id: 'gen5', name: '5.5 kW Petrol Generator', kw: 5.5, litresPerKwh: 0.45, price: 650, kind: 'generator' },
  { id: 'gen60', name: '60 kW Diesel Genset', kw: 60, litresPerKwh: 0.28, price: 12000, kind: 'generator' },
  { id: 'gen200', name: '200 kW Silent Diesel Genset', kw: 200, litresPerKwh: 0.26, price: 38000, kind: 'generator' },
);
RISERS.push(
  { id: 'riser009splus', name: 'PCIe Riser 009S Plus (6-pin)', power: '6-pin', reliability: 0.8, fireRisk: 0, price: 8, kind: 'riser' },
  { id: 'riser010s', name: 'PCIe Riser 010S (Molex)', power: 'Molex', reliability: 0.9, fireRisk: 0, price: 7, kind: 'riser' },
  { id: 'riser012plus', name: 'PCIe Riser 012 Plus (LED, 6-pin)', power: '6-pin', reliability: 0.5, fireRisk: 0, price: 11, kind: 'riser' },
  { id: 'riserribbon', name: 'Unpowered Ribbon Riser (x1)', power: 'None', reliability: 1.6, fireRisk: 2, price: 2, kind: 'riser' },
);
BOOT.push(
  { id: 'usb32', name: '32 GB USB 3.1 Flash Drive', gb: 32, reliability: 1.6, price: 10, kind: 'boot', style: 'usb' },
  { id: 'usb64', name: '64 GB USB Industrial Flash', gb: 64, reliability: 0.9, price: 24, kind: 'boot', style: 'usb' },
  { id: 'ssd240', name: '240 GB SATA SSD', gb: 240, reliability: 0.6, price: 30, kind: 'boot', style: 'ssd' },
  { id: 'nvme1t', name: '1 TB M.2 NVMe SSD', gb: 1000, reliability: 0.35, price: 65, kind: 'boot', style: 'nvme' },
);
MODS.push(
  { id: 'paste', name: 'Thermal Paste Re-paste Kit', desc: 'Fresh paste on the GPU die: slower wear and +1% hashrate.', price: 8, kind: 'mod' },
  { id: 'fans', name: 'GPU Fan Replacement Set', desc: 'New fans: restores 25% condition on a worn card.', price: 18, kind: 'mod', consumable: true },
);

import { HARDWARE } from './hardware.js';
export { CASES, BOARDS, CPUS, RAM, DRIVES, UPSES, DRIVE_CLASS, CLIENT_TYPES, SERVER_OS } from './hardware.js';
export const ALL_ITEMS = [...GPUS, ...ASICS, ...PSUS, ...FRAMES, ...COOLING, ...RACKS, ...INVERTERS, ...BATTERIES, ...SOLAR, ...GENERATORS, ...RISERS, ...BOOT, ...MODS, ...HARDWARE];
export const byId = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
