<h1 align="center">⛏️ HashForge</h1>

<p align="center"><b>Build GPU & ASIC mining rigs, survive load-shedding, pay the power bill, and grow a hashrate empire.</b><br>
A mining tycoon that runs in your browser: 2D management, 3D hands-on hardware.</p>

<p align="center">
  <a href="https://github.com/BullisticZA/hashforge/actions/workflows/ci.yml"><img src="https://github.com/BullisticZA/hashforge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/engine-three.js-black?logo=threedotjs" alt="three.js">
  <img src="https://img.shields.io/badge/install-none-5ee7ff" alt="No install">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
</p>

<p align="center"><b>▶ Play now:</b> <a href="https://bullisticza.github.io/hashforge/">bullisticza.github.io/hashforge</a></p>

<p align="center"><img src="assets/screens/floor.jpg" alt="The 2D management floor" width="900"></p>

---

## 🎮 What you do

Start in a bedroom corner with a little savings and a dream. Buy a rig kit, a power supply and a few graphics cards, or dig through the **junkyard** for broken cards and parts and build your own on the **workbench**. Watch the power bill. Survive **load-shedding**. Expand to a garage, a warehouse, then a hydro-powered mining hall. When you've built an empire, **Hard Fork**: reset for permanent upgrades and start a harder era.

| | |
|---|---|
| <img src="assets/screens/workshop.jpg" alt="3D rig workshop"> | <img src="assets/screens/exploded.jpg" alt="Exploded GPU view"> |
| **3D rig workshop:** install cards and PSUs, see every riser and heatpipe | **Exploded view:** fans, shroud, fin stack, heatpipes, PCB, backplate |
| <img src="assets/screens/junkyard.jpg" alt="Junkyard lot reveal"> | <img src="assets/screens/outage.jpg" alt="Load-shedding in 3D"> |
| **Junkyard:** open lots, find parts, hunt golden samples | **Load-shedding:** the lights die, fans stop, the money stops |
| <img src="assets/screens/rig-cables.jpg" alt="Risers and cabling"> | <img src="assets/screens/room.jpg" alt="3D tour"> |
| **Risers & cabling:** every card on a riser, USB to the motherboard, PCIe power into each socket | **3D tour:** walk your whole operation |

## ✨ Features

- **54 real GPUs and ASIC miners** (GeForce RTX 50 to GTX 10, Radeon RX 7000 to RX 500, Intel Arc, Antminer, Whatsminer and more) with approximate hash rates per algorithm
- **Six algorithms:** SHA-256, Scrypt, kHeavyHash, KawPow, Etchash, Autolykos2. Rigs auto-switch to the most profitable
- **Vendors, a used marketplace and a junkyard**, with quality grades from Scrap to **Golden Sample**
- **GPU crafting:** match a core, memory, PCB and cooler; salvage cards back into parts
- **Realistic rigs:** PCIe risers (cheap SATA ones can catch fire), USB riser cables, boot drives, Linux or Windows mining OS, thermal pads and copper shims
- **Real power engineering:** PSU load and efficiency, circuit breakers, rack PDUs, heat and throttling, AC and immersion cooling
- **Load-shedding stages 1–8**, solar that follows the sun, seasons and clouds, hybrid inverters that trip when overloaded, batteries that wear out, diesel generators
- **Your currency:** detects South Africa (Rand) and other regions, uses a typical tariff you can edit, and converts at live exchange rates
- **Wear and failures**, repairs and servicing; a market with bull runs, crashes, rising difficulty and halvings
- **Prestige:** Hard Fork for Fork Shards and 8 endlessly-levelling upgrades; every era is harder
- **Advisor** that spots problems: overloaded PSUs, unprofitable miners, inverter limits, heat
- Saves automatically in your browser. No account, no install, works offline

See the [ROADMAP](ROADMAP.md) for what's next: PC and server building, networking and firewalls, hosting for clients, and much more.

## 🕹️ Controls

| Key / action | What it does |
|---|---|
| `Space` | Pause / resume |
| `1`–`4` | Game speed (1, 6, 24, 96 game hours per second) |
| Click a rig or rack | Manage it; **Open in 3D workshop** to install parts |
| 🎥 3D Tour | Walk around your whole operation in 3D |
| `Esc` | Close a 3D view |

## 🛠️ Run it locally

No build step. Serve the folder with any static web server:

```bash
git clone https://github.com/BullisticZA/hashforge.git
cd hashforge
python -m http.server 8000      # then open http://localhost:8000
```

Run the simulation tests (Node 20+):

```bash
node --test tests/*.test.mjs
```

The game logic (`js/sim/engine.js`) is pure JavaScript with no DOM, so every rule (power dispatch, load-shedding, heat, wear, crafting, prestige, economy balance) is covered by tests.

## 📜 License & credits

[MIT](LICENSE) © 2026 Charl Britz. 3D rendering by [three.js](https://threejs.org) (MIT).

Hardware names identify real products and belong to their respective owners. HashForge is not affiliated with or endorsed by any manufacturer. All 3D models are original artwork, not replicas of product designs. Hash rates, prices and tariffs are approximations, and coin prices are simulated. This is a game, not financial advice.
