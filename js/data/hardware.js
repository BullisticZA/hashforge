// PCs, servers and NAS: cases, boards, CPUs, memory, drives and UPS units.
// Real product names with approximate specs and USD street prices (new). Used enterprise gear is cheap.
//
// Compatibility rules the engine checks:
//  - A case either has a built-in board (NUCs, NAS appliances, branded rack servers) or takes a
//    motherboard whose form factor it lists in `forms`.
//  - CPUs must match the board socket. Built-in "integrated" boards already include their CPU.
//  - RAM type must match the board (DDR4 / DDR5 desktop, SO-DIMM for minis, ECC RDIMM for servers).
//  - SATA/SAS drives need a bay (3.5" bays also take 2.5" drives); SAS needs a SAS backplane (`sas`).
//  - M.2 NVMe drives need a free M.2 slot on the board.

// ---------------------------------------------------------------- built-in boards
// ramBuiltin: memory the appliance ships with (NAS boxes); extra modules add to it.
const integrated = (cpu, cores, threads, cpuW, ramType, ramSlots, maxRam, m2, extra = {}) => ({
  form: 'integrated', socket: 'integrated', cpu, cores, threads, cpuW, ramType, ramSlots, maxRam, m2, cpuSockets: 0, ...extra,
});

// ---------------------------------------------------------------- cases (kind: 'case')
// type: nuc | nas | tower | rack. bays35 / bays25 = drive bays. gpuSlots = full-length GPU slots.
// psu: 'builtin' means the case already has a power supply (watts, efficiency).
const box = (id, name, maker, type, price, year, o) => ({ id, name, maker, type, price, year, kind: 'case', ...o });

export const CASES = [
  // Mini PCs (barebones: add SO-DIMM RAM and an M.2 SSD)
  box('m720q', 'Lenovo ThinkCentre M720q Tiny (used)', 'Lenovo', 'nuc', 90, 2018, { board: integrated('Core i5-8500T', 6, 6, 35, 'DDR4-SO', 2, 32, 1, { sata: 1 }), bays25: 1, psu: { watts: 65, efficiency: 0.87 }, gpuSlots: 0, style: 'tiny' }),
  box('optiplex7090', 'Dell OptiPlex 7090 Micro (used)', 'Dell', 'nuc', 160, 2021, { board: integrated('Core i5-10500T', 6, 12, 35, 'DDR4-SO', 2, 64, 1, { sata: 1 }), bays25: 1, psu: { watts: 90, efficiency: 0.88 }, gpuSlots: 0, style: 'tiny' }),
  box('nuc13pro', 'Intel NUC 13 Pro (i5-1340P)', 'Intel', 'nuc', 420, 2023, { board: integrated('Core i5-1340P', 12, 16, 28, 'DDR4-SO', 2, 64, 2), bays25: 0, psu: { watts: 120, efficiency: 0.88 }, gpuSlots: 0, style: 'nuc' }),
  box('nuc14pro', 'ASUS NUC 14 Pro (Core Ultra 5 125H)', 'ASUS', 'nuc', 520, 2024, { board: integrated('Core Ultra 5 125H', 14, 18, 28, 'DDR5-SO', 2, 96, 2), bays25: 1, psu: { watts: 120, efficiency: 0.89 }, gpuSlots: 0, style: 'nuc' }),
  box('ser7', 'Beelink SER7 (Ryzen 7 7840HS)', 'Beelink', 'nuc', 450, 2023, { board: integrated('Ryzen 7 7840HS', 8, 16, 45, 'DDR5-SO', 2, 64, 2), bays25: 0, psu: { watts: 120, efficiency: 0.88 }, gpuSlots: 0, style: 'nuc' }),
  box('ms01', 'Minisforum MS-01 (i9-13900H, 10GbE)', 'Minisforum', 'nuc', 680, 2024, { board: integrated('Core i9-13900H', 14, 20, 45, 'DDR5-SO', 2, 96, 3, { nic10g: true }), bays25: 0, psu: { watts: 180, efficiency: 0.9 }, gpuSlots: 0, style: 'nuc' }),
  // NAS appliances (add drives; some take extra RAM)
  box('ds224', 'Synology DiskStation DS224+', 'Synology', 'nas', 300, 2023, { board: integrated('Celeron J4125', 4, 4, 10, 'DDR4-SO', 1, 6, 0, { ramBuiltin: 2 }), bays35: 2, psu: { watts: 60, efficiency: 0.88 }, gpuSlots: 0, style: 'nas2' }),
  box('ts464', 'QNAP TS-464', 'QNAP', 'nas', 550, 2022, { board: integrated('Celeron N5095', 4, 4, 15, 'DDR4-SO', 2, 16, 2, { ramBuiltin: 8 }), bays35: 4, psu: { watts: 90, efficiency: 0.88 }, gpuSlots: 0, style: 'nas4' }),
  box('ds923', 'Synology DiskStation DS923+', 'Synology', 'nas', 600, 2022, { board: integrated('Ryzen R1600', 2, 4, 25, 'DDR4-ECC-SO', 2, 32, 2, { ecc: true, ramBuiltin: 4 }), bays35: 4, psu: { watts: 100, efficiency: 0.88 }, gpuSlots: 0, style: 'nas4' }),
  box('truenasminix', 'TrueNAS Mini X+', 'iXsystems', 'nas', 1300, 2021, { board: integrated('Atom C3758', 8, 8, 25, 'DDR4-ECC', 4, 64, 0, { ecc: true, ramBuiltin: 32 }), bays35: 5, bays25: 2, psu: { watts: 250, efficiency: 0.9 }, gpuSlots: 0, style: 'nas5' }),
  box('ds1821', 'Synology DiskStation DS1821+', 'Synology', 'nas', 1050, 2021, { board: integrated('Ryzen V1500B', 4, 8, 16, 'DDR4-ECC-SO', 2, 32, 2, { ecc: true, ramBuiltin: 4 }), bays35: 8, psu: { watts: 250, efficiency: 0.9 }, gpuSlots: 0, style: 'nas8' }),
  // Towers (add a motherboard, CPU, RAM, drives and a PSU)
  box('n400', 'Cooler Master MasterBox N400', 'Cooler Master', 'tower', 55, 2017, { forms: ['matx'], bays35: 2, bays25: 2, gpuSlots: 1, style: 'tower' }),
  box('h5flow', 'NZXT H5 Flow', 'NZXT', 'tower', 95, 2023, { forms: ['matx', 'atx'], bays35: 1, bays25: 2, gpuSlots: 1, style: 'towerGlass' }),
  box('north', 'Fractal Design North', 'Fractal Design', 'tower', 140, 2023, { forms: ['matx', 'atx'], bays35: 2, bays25: 2, gpuSlots: 1, style: 'towerWood' }),
  box('o11evo', 'Lian Li O11 Dynamic EVO', 'Lian Li', 'tower', 170, 2022, { forms: ['matx', 'atx', 'eatx'], bays35: 4, bays25: 6, gpuSlots: 2, style: 'towerGlass' }),
  box('define7xl', 'Fractal Design Define 7 XL', 'Fractal Design', 'tower', 230, 2020, { forms: ['matx', 'atx', 'eatx'], bays35: 18, bays25: 5, gpuSlots: 2, style: 'towerBig' }),
  // Rackmount chassis (add a server board, CPUs, ECC RAM, drives; redundant PSUs built in)
  box('cse813', 'Supermicro CSE-813 1U Chassis', 'Supermicro', 'rack', 180, 2016, { forms: ['matx', 'atx', 'server'], bays35: 4, gpuSlots: 0, sas: true, psu: { watts: 400, efficiency: 0.92 }, rackU: 1, style: 'rack1u' }),
  box('cse826', 'Supermicro CSE-826 2U 12-Bay Chassis', 'Supermicro', 'rack', 320, 2016, { forms: ['atx', 'eatx', 'server'], bays35: 12, gpuSlots: 1, sas: true, psu: { watts: 920, efficiency: 0.94 }, rackU: 2, style: 'rack2u' }),
  box('cse846', 'Supermicro CSE-846 4U 24-Bay Chassis', 'Supermicro', 'rack', 520, 2016, { forms: ['atx', 'eatx', 'server'], bays35: 24, gpuSlots: 2, sas: true, psu: { watts: 1200, efficiency: 0.94 }, rackU: 4, style: 'rack4u' }),
  // Branded rack servers with their own dual-socket board: add CPUs, ECC RAM and drives
  box('dl360g8', 'HPE ProLiant DL360p Gen8 (used)', 'HPE', 'rack', 160, 2012, { board: { form: 'server', socket: 'LGA2011', cpuSockets: 2, ramType: 'DDR3-ECC', ramSlots: 24, maxRam: 768, m2: 0, ecc: true }, bays25: 8, gpuSlots: 0, sas: true, psu: { watts: 750, efficiency: 0.92 }, rackU: 1, style: 'rack1u' }),
  box('r730', 'Dell PowerEdge R730 (used)', 'Dell', 'rack', 350, 2014, { board: { form: 'server', socket: 'LGA2011-3', cpuSockets: 2, ramType: 'DDR4-ECC', ramSlots: 24, maxRam: 1536, m2: 0, ecc: true }, bays35: 8, gpuSlots: 1, sas: true, psu: { watts: 1100, efficiency: 0.94 }, rackU: 2, style: 'rack2u' }),
  box('dl380g10', 'HPE ProLiant DL380 Gen10 (used)', 'HPE', 'rack', 900, 2017, { board: { form: 'server', socket: 'LGA3647', cpuSockets: 2, ramType: 'DDR4-ECC', ramSlots: 24, maxRam: 3072, m2: 1, ecc: true }, bays25: 24, gpuSlots: 2, sas: true, psu: { watts: 1600, efficiency: 0.94 }, rackU: 2, style: 'rack2u' }),
  box('r750', 'Dell PowerEdge R750', 'Dell', 'rack', 4200, 2021, { board: { form: 'server', socket: 'LGA4189', cpuSockets: 2, ramType: 'DDR4-ECC', ramSlots: 32, maxRam: 8192, m2: 2, ecc: true }, bays25: 24, gpuSlots: 2, sas: true, psu: { watts: 1400, efficiency: 0.96 }, rackU: 2, style: 'rack2u' }),
];

// ---------------------------------------------------------------- motherboards (kind: 'board')
const mobo = (id, name, maker, form, socket, ramType, ramSlots, maxRam, m2, sata, price, year, extra = {}) =>
  ({ id, name, maker, form, socket, ramType, ramSlots, maxRam, m2, sata, cpuSockets: 1, price, year, kind: 'board', ...extra });
export const BOARDS = [
  mobo('a520m', 'ASUS PRIME A520M-K', 'ASUS', 'matx', 'AM4', 'DDR4', 2, 64, 1, 4, 60, 2020),
  mobo('b550tomahawk', 'MSI MAG B550 TOMAHAWK', 'MSI', 'atx', 'AM4', 'DDR4', 4, 128, 2, 6, 150, 2020),
  mobo('b650ma', 'ASUS PRIME B650M-A', 'ASUS', 'matx', 'AM5', 'DDR5', 4, 192, 2, 4, 150, 2023),
  mobo('x670eaorus', 'Gigabyte X670E AORUS MASTER', 'Gigabyte', 'eatx', 'AM5', 'DDR5', 4, 192, 4, 6, 450, 2022),
  mobo('b760ds3h', 'Gigabyte B760 DS3H DDR4', 'Gigabyte', 'atx', 'LGA1700', 'DDR4', 4, 128, 2, 4, 110, 2023),
  mobo('z790e', 'ASUS ROG STRIX Z790-E', 'ASUS', 'atx', 'LGA1700', 'DDR5', 4, 192, 5, 4, 430, 2022),
  mobo('x570d4u', 'ASRock Rack X570D4U (IPMI)', 'ASRock Rack', 'matx', 'AM4', 'DDR4-ECC', 4, 128, 2, 8, 280, 2020, { ecc: true }),
  mobo('x10dri', 'Supermicro X10DRi (dual socket)', 'Supermicro', 'eatx', 'LGA2011-3', 'DDR4-ECC', 16, 2048, 0, 10, 180, 2015, { cpuSockets: 2, ecc: true }),
  mobo('x11spl', 'Supermicro X11SPL-F', 'Supermicro', 'atx', 'LGA3647', 'DDR4-ECC', 8, 1024, 1, 8, 320, 2018, { ecc: true }),
  mobo('h12ssl', 'Supermicro H12SSL-i (EPYC)', 'Supermicro', 'server', 'SP3', 'DDR4-ECC', 8, 2048, 2, 8, 650, 2020, { ecc: true }),
  mobo('mz33ar0', 'Gigabyte MZ33-AR0 (EPYC 9004)', 'Gigabyte', 'server', 'SP5', 'DDR5-ECC', 24, 3072, 4, 8, 1250, 2023, { ecc: true }),
];

// ---------------------------------------------------------------- CPUs (kind: 'cpu')
const cpu = (id, name, maker, socket, cores, threads, watts, price, year) => ({ id, name, maker, socket, cores, threads, watts, price, year, kind: 'cpu' });
export const CPUS = [
  cpu('r5_5600', 'AMD Ryzen 5 5600', 'AMD', 'AM4', 6, 12, 65, 110, 2022),
  cpu('r7_5700x', 'AMD Ryzen 7 5700X', 'AMD', 'AM4', 8, 16, 65, 160, 2022),
  cpu('r9_5950x', 'AMD Ryzen 9 5950X', 'AMD', 'AM4', 16, 32, 105, 330, 2020),
  cpu('r5_7600', 'AMD Ryzen 5 7600', 'AMD', 'AM5', 6, 12, 65, 190, 2023),
  cpu('r7_7700x', 'AMD Ryzen 7 7700X', 'AMD', 'AM5', 8, 16, 105, 280, 2022),
  cpu('r9_7950x', 'AMD Ryzen 9 7950X', 'AMD', 'AM5', 16, 32, 170, 520, 2022),
  cpu('r9_9950x', 'AMD Ryzen 9 9950X', 'AMD', 'AM5', 16, 32, 170, 600, 2024),
  cpu('i3_12100', 'Intel Core i3-12100', 'Intel', 'LGA1700', 4, 8, 60, 100, 2022),
  cpu('i5_12400', 'Intel Core i5-12400', 'Intel', 'LGA1700', 6, 12, 65, 140, 2022),
  cpu('i5_13600k', 'Intel Core i5-13600K', 'Intel', 'LGA1700', 14, 20, 125, 290, 2022),
  cpu('i7_14700k', 'Intel Core i7-14700K', 'Intel', 'LGA1700', 20, 28, 125, 390, 2023),
  cpu('i9_14900k', 'Intel Core i9-14900K', 'Intel', 'LGA1700', 24, 32, 125, 540, 2023),
  cpu('e5_2650v2', 'Intel Xeon E5-2650 v2 (used)', 'Intel', 'LGA2011', 8, 16, 95, 12, 2013),
  cpu('e5_2697v2', 'Intel Xeon E5-2697 v2 (used)', 'Intel', 'LGA2011', 12, 24, 130, 35, 2013),
  cpu('e5_2680v4', 'Intel Xeon E5-2680 v4 (used)', 'Intel', 'LGA2011-3', 14, 28, 120, 25, 2016),
  cpu('e5_2699v4', 'Intel Xeon E5-2699 v4 (used)', 'Intel', 'LGA2011-3', 22, 44, 145, 120, 2016),
  cpu('silver4214', 'Intel Xeon Silver 4214', 'Intel', 'LGA3647', 12, 24, 85, 160, 2019),
  cpu('gold6248', 'Intel Xeon Gold 6248', 'Intel', 'LGA3647', 20, 40, 150, 420, 2019),
  cpu('gold6338', 'Intel Xeon Gold 6338', 'Intel', 'LGA4189', 32, 64, 205, 1400, 2021),
  cpu('epyc7302', 'AMD EPYC 7302', 'AMD', 'SP3', 16, 32, 155, 300, 2019),
  cpu('epyc7763', 'AMD EPYC 7763', 'AMD', 'SP3', 64, 128, 280, 2200, 2021),
  cpu('epyc9654', 'AMD EPYC 9654', 'AMD', 'SP5', 96, 192, 360, 5500, 2022),
];

// ---------------------------------------------------------------- memory (kind: 'ram'), one module each
const ram = (id, name, type, gb, price, year) => ({ id, name, type, gb, price, year, kind: 'ram' });
export const RAM = [
  ram('so4_8', '8 GB DDR4-3200 SO-DIMM', 'DDR4-SO', 8, 18, 2020),
  ram('so4_16', '16 GB DDR4-3200 SO-DIMM', 'DDR4-SO', 16, 32, 2020),
  ram('so4_32', '32 GB DDR4-3200 SO-DIMM', 'DDR4-SO', 32, 60, 2021),
  ram('so4e_16', '16 GB DDR4 ECC SO-DIMM (NAS)', 'DDR4-ECC-SO', 16, 75, 2021),
  ram('so5_16', '16 GB DDR5-5600 SO-DIMM', 'DDR5-SO', 16, 45, 2023),
  ram('so5_48', '48 GB DDR5-5600 SO-DIMM', 'DDR5-SO', 48, 120, 2024),
  ram('d4_8', '8 GB DDR4-3200 DIMM', 'DDR4', 8, 18, 2019),
  ram('d4_16', '16 GB DDR4-3200 DIMM', 'DDR4', 16, 30, 2019),
  ram('d4_32', '32 GB DDR4-3200 DIMM', 'DDR4', 32, 55, 2020),
  ram('d5_16', '16 GB DDR5-6000 DIMM', 'DDR5', 16, 50, 2023),
  ram('d5_32', '32 GB DDR5-6000 DIMM', 'DDR5', 32, 95, 2023),
  ram('d5_48', '48 GB DDR5-6000 DIMM', 'DDR5', 48, 140, 2024),
  ram('d3e_16', '16 GB DDR3 ECC RDIMM (used)', 'DDR3-ECC', 16, 6, 2013),
  ram('d4e_32', '32 GB DDR4 ECC RDIMM', 'DDR4-ECC', 32, 70, 2018),
  ram('d4e_64', '64 GB DDR4 ECC RDIMM', 'DDR4-ECC', 64, 130, 2019),
  ram('d5e_64', '64 GB DDR5 ECC RDIMM', 'DDR5-ECC', 64, 320, 2023),
];

// ---------------------------------------------------------------- drives (kind: 'drive')
// iface: sata | sas | nvme. size: 3.5 | 2.5 | m2. class sets 24/7 reliability:
// desktop drives aren't rated for always-on use; NAS, surveillance and enterprise drives are.
const drv = (id, name, maker, iface, size, tb, cls, watts, price, year) => ({ id, name, maker, iface, size, tb, cls, watts, price, year, kind: 'drive' });
export const DRIVES = [
  drv('barra2', 'Seagate BarraCuda 2 TB', 'Seagate', 'sata', 3.5, 2, 'desktop', 5, 55, 2019),
  drv('wdblue4', 'WD Blue 4 TB', 'WD', 'sata', 3.5, 4, 'desktop', 5, 80, 2020),
  drv('redplus4', 'WD Red Plus 4 TB (NAS)', 'WD', 'sata', 3.5, 4, 'nas', 4, 95, 2021),
  drv('redplus8', 'WD Red Plus 8 TB (NAS)', 'WD', 'sata', 3.5, 8, 'nas', 5, 170, 2021),
  drv('ironwolf8', 'Seagate IronWolf 8 TB (NAS)', 'Seagate', 'sata', 3.5, 8, 'nas', 6, 165, 2021),
  drv('ironwolfpro16', 'Seagate IronWolf Pro 16 TB', 'Seagate', 'sata', 3.5, 16, 'nas', 7, 300, 2022),
  drv('redpro20', 'WD Red Pro 20 TB', 'WD', 'sata', 3.5, 20, 'nas', 7, 380, 2023),
  drv('purple4', 'WD Purple 4 TB (surveillance)', 'WD', 'sata', 3.5, 4, 'surveillance', 4, 90, 2021),
  drv('skyhawk8', 'Seagate SkyHawk 8 TB (surveillance)', 'Seagate', 'sata', 3.5, 8, 'surveillance', 6, 160, 2021),
  drv('skyhawkai16', 'Seagate SkyHawk AI 16 TB', 'Seagate', 'sata', 3.5, 16, 'surveillance', 7, 310, 2022),
  drv('exos18', 'Seagate Exos X18 18 TB', 'Seagate', 'sata', 3.5, 18, 'enterprise', 8, 300, 2021),
  drv('exos24', 'Seagate Exos X24 24 TB', 'Seagate', 'sata', 3.5, 24, 'enterprise', 9, 430, 2024),
  drv('hc560', 'WD Ultrastar HC560 20 TB', 'WD', 'sata', 3.5, 20, 'enterprise', 7, 360, 2022),
  drv('sas900', 'HPE 900 GB 10K SAS 2.5" (used)', 'HPE', 'sas', 2.5, 0.9, 'enterprise', 7, 20, 2015),
  drv('sas1t2', 'Seagate Exos 10E2400 1.2 TB SAS', 'Seagate', 'sas', 2.5, 1.2, 'enterprise', 7, 45, 2018),
  drv('sas8', 'Seagate Exos 7E8 8 TB SAS', 'Seagate', 'sas', 3.5, 8, 'enterprise', 9, 140, 2019),
  drv('evo870', 'Samsung 870 EVO 1 TB SSD', 'Samsung', 'sata', 2.5, 1, 'ssd', 3, 80, 2021),
  drv('mx500_2', 'Crucial MX500 2 TB SSD', 'Crucial', 'sata', 2.5, 2, 'ssd', 3, 120, 2020),
  drv('pm893', 'Samsung PM893 3.84 TB Enterprise SSD', 'Samsung', 'sata', 2.5, 3.84, 'enterprisessd', 3, 330, 2021),
  drv('sn850x1', 'WD Black SN850X 1 TB NVMe', 'WD', 'nvme', 'm2', 1, 'ssd', 6, 85, 2022),
  drv('p3plus4', 'Crucial P3 Plus 4 TB NVMe', 'Crucial', 'nvme', 'm2', 4, 'ssd', 6, 230, 2022),
  drv('990pro2', 'Samsung 990 PRO 2 TB NVMe', 'Samsung', 'nvme', 'm2', 2, 'ssd', 7, 170, 2022),
  drv('pm9a3', 'Samsung PM9A3 7.68 TB NVMe (enterprise)', 'Samsung', 'nvme', 'm2', 7.68, 'enterprisessd', 12, 700, 2021),
];
/** Daily failure-rate multiplier by drive class when running 24/7. */
export const DRIVE_CLASS = {
  desktop: { name: 'Desktop', fail: 3.0, note: 'Not rated for 24/7: fails far more often in a server' },
  nas: { name: 'NAS', fail: 1.0, note: 'Rated for 24/7 in small arrays' },
  surveillance: { name: 'Surveillance', fail: 1.0, note: 'Tuned for constant video writes: required for CCTV clients' },
  enterprise: { name: 'Enterprise', fail: 0.6, note: 'Built for data centres: the most reliable spinning drives' },
  ssd: { name: 'SSD', fail: 0.7, note: 'Fast and quiet' },
  enterprisessd: { name: 'Enterprise SSD', fail: 0.4, note: 'Power-loss protection and high endurance' },
};

// ---------------------------------------------------------------- UPS (kind: 'ups'): keeps servers up through outages
export const UPSES = [
  { id: 'bx700', name: 'APC Back-UPS 700VA', wh: 120, maxW: 390, price: 90, year: 2019, kind: 'ups', style: 'small' },
  { id: 'smt1500', name: 'APC Smart-UPS 1500VA', wh: 400, maxW: 1000, price: 520, year: 2018, kind: 'ups', style: 'tower' },
  { id: 'eaton5px3k', name: 'Eaton 5PX 3000 (rack)', wh: 900, maxW: 2700, price: 1400, year: 2020, kind: 'ups', style: 'rack' },
  { id: 'mecer3k', name: 'Mecer 3kVA Online UPS + battery pack', wh: 2200, maxW: 2700, price: 950, year: 2021, kind: 'ups', style: 'tower' },
];

// ---------------------------------------------------------------- hosting clients
// needs: vcpu threads, ramGB, storage TB. gpuVram: needs a GPU with this much VRAM. ecc: needs an ECC server.
// cls: storage must sit on drives of this class. raid: storage must be protected (mirror/RAID).
// pay: USD per month. minRep: reputation (0-100) needed before these clients find you.
export const CLIENT_TYPES = [
  { id: 'site', name: 'Small business website', icon: '🌐', vcpu: 1, ramGB: 2, tb: 0.02, pay: 15, sla: 0.9, minRep: 0, months: [6, 12] },
  { id: 'wp', name: 'WordPress online shop', icon: '🛒', vcpu: 2, ramGB: 4, tb: 0.05, pay: 40, sla: 0.97, minRep: 5, months: [6, 12] },
  { id: 'game', name: 'Minecraft game server', icon: '🎮', vcpu: 4, ramGB: 8, tb: 0.05, pay: 35, sla: 0.85, minRep: 0, months: [2, 6] },
  { id: 'backup', name: 'Off-site backups for a practice', icon: '💾', vcpu: 1, ramGB: 2, tbRange: [1, 6], payPerTb: 7, pay: 10, sla: 0.85, raid: true, minRep: 5, months: [6, 18] },
  { id: 'mail', name: 'Email hosting for an office', icon: '✉️', vcpu: 2, ramGB: 4, tb: 0.2, pay: 60, sla: 0.98, minRep: 10, months: [6, 12] },
  { id: 'cctv', name: 'CCTV recording for a shop', icon: '📹', vcpu: 2, ramGB: 4, camRange: [4, 16], tbPerCam: 0.5, payPerCam: 6, pay: 15, sla: 0.97, cls: 'surveillance', minRep: 10, months: [12, 24] },
  { id: 'plex', name: 'Media library for a guesthouse', icon: '🎬', vcpu: 4, ramGB: 8, tb: 8, pay: 55, sla: 0.85, minRep: 10, months: [6, 12] },
  { id: 'files', name: 'Office file server (Windows)', icon: '🗂️', vcpu: 2, ramGB: 8, tb: 1, pay: 90, sla: 0.98, os: 'windows', raid: true, minRep: 20, months: [12, 24] },
  { id: 'dev', name: 'Dev and test VMs for a software team', icon: '🧪', vcpu: 8, ramGB: 32, tb: 0.5, pay: 160, sla: 0.95, minRep: 25, months: [3, 12] },
  { id: 'render', name: 'Design studio render node', icon: '🎨', vcpu: 8, ramGB: 32, tb: 0.5, gpuVram: 8, pay: 220, sla: 0.9, minRep: 30, months: [2, 6] },
  { id: 'erp', name: 'Accounting / ERP database', icon: '📊', vcpu: 8, ramGB: 64, tb: 1, pay: 350, sla: 0.99, ecc: true, raid: true, minRep: 40, months: [12, 36] },
  { id: 'storage', name: 'Cloud storage reseller', icon: '☁️', vcpu: 2, ramGB: 8, tbRange: [10, 60], payPerTb: 4, pay: 0, sla: 0.98, raid: true, minRep: 45, months: [12, 24] },
  { id: 'ai', name: 'AI inference API', icon: '🤖', vcpu: 16, ramGB: 64, tb: 1, gpuVram: 16, pay: 650, sla: 0.98, minRep: 55, months: [3, 12] },
  { id: 'vps', name: 'VPS reseller block', icon: '🖥️', vcpu: 32, ramGB: 128, tb: 2, pay: 900, sla: 0.99, ecc: true, raid: true, minRep: 65, months: [12, 24] },
];

export const SERVER_OS = {
  linux: { name: 'Linux (Ubuntu Server)', licence: 0, desc: 'Free. Runs almost everything.' },
  windows: { name: 'Windows Server 2025 Standard', licence: 450, desc: 'Licence per machine. Needed for Windows file servers and Active Directory.' },
};

export const HARDWARE = [...CASES, ...BOARDS, ...CPUS, ...RAM, ...DRIVES, ...UPSES];
