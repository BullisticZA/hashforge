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
  { id: 'bedroom', name: 'Bedroom Corner', rigSlots: 2, rackSlots: 1, coolingSlots: 2, roofKwp: 4.4, circuitKw: 3.6, tariffMult: 1.0, ambient: 24, roomSize: 1, price: 0, w: 10, d: 8 },
  { id: 'garage', name: 'Double Garage', rigSlots: 6, rackSlots: 2, coolingSlots: 3, roofKwp: 12, circuitKw: 15, tariffMult: 0.9, ambient: 26, roomSize: 2.2, price: 6000, w: 16, d: 12 },
  { id: 'warehouse', name: 'Industrial Warehouse', rigSlots: 16, rackSlots: 6, coolingSlots: 6, roofKwp: 100, circuitKw: 120, tariffMult: 0.6, ambient: 22, roomSize: 6, price: 45000, w: 30, d: 20 },
  { id: 'hydro', name: 'Hydro-Powered Mining Hall', rigSlots: 30, rackSlots: 14, coolingSlots: 10, roofKwp: 200, circuitKw: 500, tariffMult: 0.25, ambient: 12, roomSize: 14, price: 250000, w: 44, d: 28 },
];

export const ALL_ITEMS = [...GPUS, ...ASICS, ...PSUS, ...FRAMES, ...COOLING, ...RACKS, ...INVERTERS, ...BATTERIES, ...SOLAR, ...GENERATORS];
export const byId = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
