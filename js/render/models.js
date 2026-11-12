// Procedural 3D hardware. Everything is built from primitives: original designs, no logos, no textures from products.
// Units: 1 unit = 10 cm. GPUs lie with length on X, height on Y, fans facing +Z.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ACCENT = { nvidia: '#5ee7ff', amd: '#ff4d6d', intel: '#7aa2ff' };
const RATING_COLOR = { Bronze: '#cd7f32', Gold: '#ffcc33', Platinum: '#d9e6f2', Titanium: '#9fb2c8' };

// ------------------------------------------------------------------ shared materials

const matCache = new Map();
function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
const M = {
  shroud: (tint = '#1a1d24') => mat(`shroud${tint}`, () => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0.55, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 })),
  anodized: () => mat('anodized', () => new THREE.MeshStandardMaterial({ color: '#22262e', metalness: 0.8, roughness: 0.42 })),
  satin: () => mat('satin', () => new THREE.MeshStandardMaterial({ color: '#2a2f38', metalness: 0.7, roughness: 0.45 })),
  alu: () => mat('alu', () => new THREE.MeshStandardMaterial({ color: '#c3cad3', metalness: 0.95, roughness: 0.28 })),
  aluDark: () => mat('aluDark', () => new THREE.MeshStandardMaterial({ color: '#6c7480', metalness: 0.9, roughness: 0.35 })),
  copper: () => mat('copper', () => new THREE.MeshStandardMaterial({ color: '#c46b3c', metalness: 1, roughness: 0.25 })),
  gold: () => mat('gold', () => new THREE.MeshStandardMaterial({ color: '#d9ad4a', metalness: 1, roughness: 0.2 })),
  pcb: () => mat('pcb', () => new THREE.MeshStandardMaterial({ color: '#0d1210', metalness: 0.2, roughness: 0.6 })),
  pcbGreen: () => mat('pcbGreen', () => new THREE.MeshStandardMaterial({ color: '#0f4d2c', metalness: 0.2, roughness: 0.55 })),
  black: () => mat('black', () => new THREE.MeshStandardMaterial({ color: '#0b0c0f', metalness: 0.3, roughness: 0.55 })),
  blade: () => mat('blade', () => new THREE.MeshStandardMaterial({ color: '#16181d', metalness: 0.1, roughness: 0.45, side: THREE.DoubleSide })),
  bladeClear: () => mat('bladeClear', () => new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', metalness: 0, roughness: 0.1, transmission: 0.6, transparent: true, opacity: 0.7, side: THREE.DoubleSide })),
  plastic: (c = '#e9ecef') => mat(`plastic${c}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(0.5), metalness: 0.05, roughness: 0.5, envMapIntensity: 0.35 })),
  rubber: () => mat('rubber', () => new THREE.MeshStandardMaterial({ color: '#1d1f23', roughness: 0.9 })),
  glow: (c) => mat(`glow${c}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5, toneMapped: false })),
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: '#9fd8ff', metalness: 0, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.25 })),
  solar: () => mat('solar', () => new THREE.MeshPhysicalMaterial({ color: '#1b3a7a', metalness: 0.5, roughness: 0.2, clearcoat: 1, emissive: '#0a1a3d', emissiveIntensity: 0.35 })),
  rust: () => mat('rust', () => new THREE.MeshStandardMaterial({ color: '#5a3a28', metalness: 0.4, roughness: 0.9 })),
  goldTrim: () => mat('goldTrim', () => new THREE.MeshStandardMaterial({ color: '#ffd166', metalness: 1, roughness: 0.15, emissive: '#5a3d00', emissiveIntensity: 0.6 })),
  liquid: () => mat('liquid', () => new THREE.MeshPhysicalMaterial({ color: '#3fa9ff', transmission: 0.7, transparent: true, opacity: 0.55, roughness: 0.05 })),
};

function box(w, h, d, material, x = 0, y = 0, z = 0, radius = 0) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, radius) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function cylinder(r, h, material, segments = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material);
  m.castShadow = true;
  return m;
}

/** Many identical boxes in one draw call (heatsink fins, vents, pins). */
function instancedBoxes(w, h, d, material, positions) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), material, positions.length);
  const m4 = new THREE.Matrix4();
  positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, m4.makeTranslation(x, y, z)));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** Text rendered to a small canvas texture (model names on labels - no logos). */
function label(text, w, h, { color = '#e6edf7', bg = null, font = 'bold 64px Inter, system-ui, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = Math.round(512 * h / w);
  const ctx = canvas.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = color; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(text).width > canvas.width * 0.9 && size > 10) { size -= 4; ctx.font = font.replace(/\d+px/, `${size}px`); }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, toneMapped: false }));
}

// ------------------------------------------------------------------ fans

/**
 * Axial fan facing +Z. The blade group is registered in `spinners` so the scene can spin it
 * at a speed that follows load (and stops during outages).
 */
export function makeFan(radius, accent = '#5ee7ff', { blades = 9, frame = 'ring', clear = false, ledRing = true } = {}) {
  const g = new THREE.Group();
  const bladeGroup = new THREE.Group();
  const bladeMat = clear ? M.bladeClear() : M.blade();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(radius * 0.4, radius * 0.1, radius * 0.75, radius * 0.16, radius * 0.95, radius * 0.1);
  shape.bezierCurveTo(radius * 0.9, -radius * 0.04, radius * 0.45, -radius * 0.06, radius * 0.25, -radius * 0.05);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: radius * 0.02, bevelEnabled: false, curveSegments: 8 });
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.rotation.z = (i / blades) * Math.PI * 2;
    b.rotation.y = 0.35;                       // blade pitch
    b.castShadow = true;
    bladeGroup.add(b);
  }
  const hub = cylinder(radius * 0.3, radius * 0.12, M.black(), 28);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = radius * 0.02;
  bladeGroup.add(hub);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.22, 28), M.satin());
  cap.position.z = radius * 0.09;
  bladeGroup.add(cap);
  g.add(bladeGroup);

  if (frame === 'ring') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.03, radius * 0.05, 10, 48), M.black());
    g.add(ring);
  } else if (frame === 'square') {
    const s = radius * 2.2;
    const t = radius * 0.12;
    for (const [x, y, w, h] of [[0, s / 2, s, t], [0, -s / 2, s, t], [s / 2, 0, t, s], [-s / 2, 0, t, s]]) g.add(box(w, h, radius * 0.5, M.black(), x, y, -radius * 0.1));
  }
  if (ledRing) {
    const led = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.0, radius * 0.01, 6, 64), M.glow(accent));
    led.position.z = radius * 0.03;
    g.add(led);
    g.userData.leds = [led];
  }
  g.userData.spinner = bladeGroup;
  return g;
}

/** Protective wire grille (ASIC and PSU fans). */
function grille(radius, material = M.aluDark()) {
  const g = new THREE.Group();
  for (const r of [0.3, 0.55, 0.8, 1.0]) g.add(new THREE.Mesh(new THREE.TorusGeometry(radius * r, radius * 0.015, 6, 40), material));
  for (let i = 0; i < 4; i++) {
    const bar = box(radius * 2, radius * 0.03, radius * 0.03, material);
    bar.rotation.z = (i / 4) * Math.PI;
    g.add(bar);
  }
  return g;
}

// ------------------------------------------------------------------ GPU

function shortName(name) {
  return name.replace(/^GeForce |^Radeon |^Arc /, '').replace(/ 8GB| 16GB/, '');
}

/**
 * A graphics card. detail: 'full' (spec viewer) or 'lite' (rooms with many cards).
 * Returns a Group with userData.layers for the exploded view and userData.spinners/leds for animation.
 */
export function makeGPU(spec, { q = 'new', detail = 'full', broken = false } = {}) {
  const root = new THREE.Group();
  const L = spec.length / 100;
  const H = 1.25;
  const T = spec.fans >= 3 ? 0.62 : spec.fans === 2 ? 0.5 : spec.passive ? 0.45 : 0.42;
  const accent = broken ? '#ff3b3b' : ACCENT[spec.vendor] || '#5ee7ff';
  const tint = q === 'scrap' ? '#3a3128' : spec.vendor === 'amd' ? '#2c2a30' : spec.vendor === 'intel' ? '#283044' : '#2b3038';
  const layers = { backplate: new THREE.Group(), pcb: new THREE.Group(), heatsink: new THREE.Group(), shroud: new THREE.Group(), fans: new THREE.Group() };
  Object.values(layers).forEach((l) => root.add(l));
  const spinners = []; const leds = [];

  // Backplate with vents
  layers.backplate.add(box(L, H, 0.035, q === 'scrap' ? M.rust() : M.satin(), 0, 0, -T / 2, 0.012));
  if (detail === 'full') {
    const vents = [];
    for (let i = 0; i < Math.floor(L * 6); i++) for (let j = 0; j < 3; j++) vents.push([-L / 2 + 0.3 + i * 0.16, 0.2 - j * 0.16, -T / 2 - 0.02]);
    layers.backplate.add(instancedBoxes(0.1, 0.035, 0.01, M.black(), vents));
  }

  // PCB with gold PCIe fingers and VRAM chips
  layers.pcb.add(box(L * 0.97, H * 0.92, 0.03, M.pcb(), 0, 0.02, -T / 2 + 0.06));
  const fingers = [];
  for (let i = 0; i < 40; i++) fingers.push([-L / 2 + 0.6 + i * 0.022, -H / 2 - 0.05, -T / 2 + 0.06]);
  layers.pcb.add(instancedBoxes(0.014, 0.12, 0.032, M.gold(), fingers));
  if (detail === 'full') {
    const chips = [];
    for (let i = 0; i < Math.min(12, spec.vram); i++) chips.push([-0.6 + (i % 6) * 0.24, 0.32 - Math.floor(i / 6) * 0.64, -T / 2 + 0.085]);
    layers.pcb.add(instancedBoxes(0.14, 0.12, 0.02, M.black(), chips));
    layers.pcb.add(box(0.45, 0.45, 0.025, M.aluDark(), -0.6, 0, -T / 2 + 0.09));     // GPU die heat spreader
  }

  // Heatsink: fin stack + copper heatpipes
  const finCount = detail === 'full' ? Math.floor(L * 28) : Math.floor(L * 9);
  const fins = [];
  for (let i = 0; i < finCount; i++) fins.push([-L / 2 + 0.15 + (i / finCount) * (L - 0.3), 0, 0]);
  const finStack = instancedBoxes(detail === 'full' ? 0.012 : 0.04, H * 0.82, T * 0.55, M.alu(), fins);
  layers.heatsink.add(finStack);
  if (detail === 'full') {
    for (let i = 0; i < 4; i++) {
      const pipe = cylinder(0.035, L * 0.9, M.copper(), 12);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, H * 0.33 - i * 0.07, -T * 0.05 + (i % 2) * 0.08);
      layers.heatsink.add(pipe);
      const bend = new THREE.Mesh(new THREE.TorusGeometry(0.12 + i * 0.03, 0.035, 8, 16, Math.PI), M.copper());
      bend.position.set(L * 0.45, H * 0.33 - i * 0.07 - 0.12 - i * 0.03, -T * 0.05 + (i % 2) * 0.08);
      bend.rotation.z = -Math.PI / 2;
      layers.heatsink.add(bend);
    }
  }

  // Shroud: front cover with fan openings, side rails and an RGB strip
  const shroud = box(L, H, 0.08, M.shroud(tint), 0, 0, T / 2 - 0.04, 0.03);
  layers.shroud.add(shroud);
  layers.shroud.add(box(L, 0.06, T * 0.9, M.shroud(tint), 0, H / 2 - 0.03, 0, 0.02));
  layers.shroud.add(box(L, 0.06, T * 0.9, M.shroud(tint), 0, -H / 2 + 0.03, 0, 0.02));
  const strip = box(L * 0.82, 0.03, 0.03, M.glow(accent), 0.1, H / 2 + 0.005, T / 2 - 0.08);
  layers.shroud.add(strip); leds.push(strip);
  if (q === 'golden') {
    layers.shroud.add(box(L * 0.98, 0.025, 0.025, M.goldTrim(), 0, -H / 2 + 0.01, T / 2 + 0.005));
    layers.shroud.add(box(L * 0.98, 0.025, 0.025, M.goldTrim(), 0, H / 2 - 0.01, T / 2 + 0.005));
  }
  // Angular accent inlays between the fans
  if (detail === 'full' && spec.fans > 0) {
    const inlay = M.aluDark();
    for (let i = 0; i <= spec.fans; i++) {
      const x = Math.max(-L / 2 + 0.25, Math.min(L / 2 - 0.25, -L / 2 + 0.25 + (L - 0.5) * (i / spec.fans) + 0.1));
      for (const sy of [1, -1]) {
        const bar = box(0.26, 0.035, 0.015, inlay, x, sy * H * 0.4, T / 2 + 0.002);
        bar.rotation.z = sy * 0.5;
        layers.shroud.add(bar);
      }
    }
    layers.shroud.add(box(L * 0.96, 0.02, 0.012, M.glow(accent), 0, -H / 2 + 0.07, T / 2 + 0.003));
  }
  // Model name on the top edge
  if (detail === 'full') {
    const name = label(shortName(spec.name), L * 0.45, 0.16, { color: accent });
    name.rotation.x = -Math.PI / 2;
    name.position.set(-L * 0.12, H / 2 + 0.002, 0);
    layers.shroud.add(name);
  }

  // Fans (blower cards have one radial fan at the end; passive cards have none - a sealed fin tunnel)
  if (spec.passive) {
    layers.shroud.add(box(L * 0.96, H * 0.94, 0.04, M.alu(), 0, 0, T / 2 + 0.005, 0.02));
    const slots = [];
    for (let i = 0; i < 14; i++) slots.push([-L / 2 + 0.3 + i * (L - 0.6) / 13, 0, T / 2 + 0.03]);
    layers.shroud.add(instancedBoxes(0.05, H * 0.7, 0.01, M.black(), slots));
  }
  const fanCount = spec.blower ? 1 : spec.fans;
  const fanR = spec.blower ? H * 0.32 : Math.min(H * 0.43, (L - 0.4) / (Math.max(1, spec.fans) * 2.05));
  if (spec.blower) layers.shroud.add(box(L * 0.6, H * 0.8, 0.02, M.black(), -L * 0.15, 0, T / 2 + 0.003));
  for (let i = 0; i < fanCount; i++) {
    const fan = makeFan(fanR, accent, { blades: detail === 'full' ? 11 : 7, ledRing: detail === 'full' });
    const x = spec.blower ? L / 2 - fanR - 0.2 : -L / 2 + 0.25 + (L - 0.5) * ((i + 0.5) / spec.fans);
    fan.position.set(x + (spec.blower ? 0 : 0.1), 0, T / 2 + 0.005);
    layers.fans.add(fan);
    spinners.push(fan.userData.spinner);
    if (fan.userData.leds) leds.push(...fan.userData.leds);
  }

  // I/O bracket with display outputs, and power connectors on the top edge
  const bracket = new THREE.Group();
  bracket.add(box(0.03, H * 1.08, T + 0.05, M.alu(), -L / 2 - 0.03, 0.03, 0));
  if (detail === 'full' && !spec.headless) {
    for (let i = 0; i < 4; i++) bracket.add(box(0.035, 0.09, 0.16, M.black(), -L / 2 - 0.045, -0.35 + i * 0.2, -T / 2 + 0.15));
    const holes = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) holes.push([-L / 2 - 0.045, 0.15 + i * 0.09, j * 0.12]);
    bracket.add(instancedBoxes(0.035, 0.05, 0.08, M.black(), holes));
  }
  layers.pcb.add(bracket);
  const connectors = spec.tdp > 400 ? [['16pin', 0.32]] : spec.tdp > 220 ? [['8pin', 0.22], ['8pin', 0.22]] : spec.tdp > 150 ? [['8pin', 0.22]] : [['6pin', 0.17]];
  const sockets = [];
  connectors.forEach(([type, w], i) => {
    const x = L * 0.3 - i * 0.27;
    const c = box(w, 0.11, 0.1, M.black(), x, H / 2 + 0.05, -T / 2 + 0.12);
    layers.pcb.add(c);
    // pin holes on top of the socket
    const pins = [];
    const n = type === '16pin' ? 8 : type === '8pin' ? 4 : 3;
    for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) pins.push([x - w / 2 + 0.03 + k * (w - 0.06) / Math.max(1, n - 1), H / 2 + 0.106, -T / 2 + 0.095 + j * 0.05]);
    layers.pcb.add(instancedBoxes(0.018, 0.005, 0.018, M.gold(), pins));
    sockets.push({ pos: new THREE.Vector3(x, H / 2 + 0.11, -T / 2 + 0.12), type, wires: type === '16pin' ? 2 : 1 });
  });

  if (broken) {
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: '#555', transparent: true, opacity: 0.35 }));
    smoke.position.set(0, H / 2 + 0.3, 0);
    root.add(smoke);
  }

  // Exploded view offsets (along Z, front to back)
  root.userData = {
    kind: 'gpu', spinners, leds, layers, size: [L, H, T], sockets,
    fingers: new THREE.Vector3(-L / 2 + 0.6 + 20 * 0.022, -H / 2 - 0.11, -T / 2 + 0.06),
    explode: { backplate: -0.9, pcb: -0.45, heatsink: 0, shroud: 0.55, fans: 1.0 },
  };
  return root;
}

// ------------------------------------------------------------------ ASIC miner

export function makeASIC(spec, { q = 'new', broken = false, detail = 'full' } = {}) {
  if (['hydro', 'heater', 'tiny'].includes(spec.style)) return makeSpecialMiner(spec, { q, broken, detail });
  const g = new THREE.Group();
  const style = spec.style;
  const dims = style === 'tall' ? [3.9, 2.25, 2.35] : style === 'mini' ? [1.4, 0.7, 1.2] : style === 'quiet' ? [3.0, 1.4, 2.6] : [4.0, 1.95, 2.9];
  const [L, H, D] = dims;   // length along X (airflow), height Y, depth Z
  const chassis = q === 'scrap' ? M.rust() : M.alu();
  const leds = []; const spinners = [];

  // Aluminium body with ridged heatsink sides
  g.add(box(L * 0.82, H, D, M.aluDark(), 0, 0, 0, 0.04));
  if (detail === 'full') {
    const ridges = [];
    const n = Math.floor(L * 6);
    for (let i = 0; i < n; i++) {
      ridges.push([-L * 0.4 + (i / n) * L * 0.8, H / 2 + 0.02, 0]);
      ridges.push([-L * 0.4 + (i / n) * L * 0.8, -H / 2 - 0.02, 0]);
    }
    g.add(instancedBoxes(0.03, 0.05, D * 0.96, chassis, ridges));
  }
  // Fan shrouds on both ends
  const fanR = Math.min(H, D) * 0.42;
  for (const side of [-1, 1]) {
    const housing = box(L * 0.09, H, D, M.black(), side * L * 0.455, 0, 0, 0.03);
    g.add(housing);
    const count = style === 'quiet' ? 1 : style === 'mini' ? 1 : 1;
    for (let i = 0; i < count; i++) {
      const fan = makeFan(fanR, '#9fb4d8', { blades: 7, frame: 'none', ledRing: false });
      fan.rotation.y = side * Math.PI / 2;
      fan.position.set(side * L * 0.5, 0, 0);
      g.add(fan);
      spinners.push(fan.userData.spinner);
      const gr = grille(fanR);
      gr.rotation.y = side * Math.PI / 2;
      gr.position.set(side * (L * 0.5 + 0.03), 0, 0);
      g.add(gr);
    }
  }
  // Power supply on top (or integrated for the tall style)
  if (style === 'box' || style === 'quiet') {
    g.add(box(L * 0.6, 0.55, D * 0.42, M.satin(), -L * 0.05, H / 2 + 0.3, -D * 0.22, 0.03));
    const psuFan = makeFan(0.2, '#9fb4d8', { blades: 7, frame: 'none', ledRing: false });
    psuFan.rotation.y = Math.PI / 2;
    psuFan.position.set(L * 0.25 + 0.01, H / 2 + 0.3, -D * 0.22);
    g.add(psuFan); spinners.push(psuFan.userData.spinner);
    // Power cables from PSU down into the hash boards
    for (let i = 0; i < 3; i++) {
      const cable = cylinder(0.03, 0.5, M.black(), 8);
      cable.position.set(-L * 0.25 + i * 0.25, H / 2 + 0.1, D * 0.05);
      g.add(cable);
    }
  }
  // Control board: Ethernet port, status LEDs, model label
  const front = new THREE.Group();
  front.add(box(0.6, 0.35, 0.04, M.pcbGreen(), 0, 0, 0));
  front.add(box(0.16, 0.13, 0.08, M.black(), -0.15, 0, 0.04));
  const ok = box(0.05, 0.05, 0.03, M.glow(broken ? '#ff3b3b' : '#33ff88'), 0.1, 0.08, 0.04);
  const act = box(0.05, 0.05, 0.03, M.glow('#ffb020'), 0.2, 0.08, 0.04);
  front.add(ok, act); leds.push(ok, act);
  front.position.set(L * 0.2, -H * 0.15, D / 2 + 0.02);
  g.add(front);
  if (detail === 'full') {
    const tag = label(spec.name, L * 0.5, 0.28, { bg: '#e8ebef', color: '#1b2533', font: 'bold 56px Inter, system-ui, sans-serif' });
    tag.position.set(-L * 0.12, H * 0.2, D / 2 + 0.006);
    g.add(tag);
  }
  if (q === 'golden') g.add(box(L * 0.82, 0.03, 0.03, M.goldTrim(), 0, H / 2 + 0.06, D / 2));
  g.userData = { kind: 'asic', spinners, leds, blink: [act], size: [L, H + 0.6, D] };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Water-cooled hydro miners, home-heater miners and tiny open-source boards. */
function makeSpecialMiner(spec, { q, broken, detail }) {
  const g = new THREE.Group();
  const leds = []; const spinners = [];
  const ok = M.glow(broken ? '#ff3b3b' : '#33ff88');
  if (spec.style === 'hydro') {
    // Slim chassis with water in/out on the front, no fans: needs a chiller loop
    g.add(box(3.6, 0.9, 2.6, q === 'scrap' ? M.rust() : M.alu(), 0, 0, 0, 0.04));
    for (const [y, c] of [[0.18, '#3b82f6'], [-0.18, '#ef4444']]) {
      const pipe = cylinder(0.09, 0.5, M.plastic(c), 14);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(1.95, y, 0.8);
      g.add(pipe);
      const fit = cylinder(0.12, 0.12, M.copper(), 14); fit.rotation.z = Math.PI / 2; fit.position.set(1.82, y, 0.8); g.add(fit);
    }
    const led = box(0.06, 0.06, 0.03, ok, 1.81, 0.3, -0.6); g.add(led); leds.push(led);
    if (detail === 'full') { const t = label(spec.name, 1.8, 0.24, { bg: '#e8ebef', color: '#1b2533' }); t.position.set(-0.4, 0, 1.306); g.add(t); }
    g.userData = { kind: 'asic', spinners, leds, blink: [led], size: [3.9, 0.9, 2.6] };
  } else if (spec.style === 'heater') {
    // Living-room friendly: rounded white body, top vent grille, a little display
    const big = spec.hashrate > 10;
    const [w, h, d] = big ? [2.4, 2.8, 1.1] : [1.1, 1.2, 0.8];
    g.add(box(w, h, d, M.plastic('#454c57'), 0, 0, 0, 0.18));
    const vents = [];
    for (let i = 0; i < 9; i++) vents.push([-w * 0.35 + i * w * 0.0875, h / 2 + 0.005, 0]);
    g.add(instancedBoxes(0.04, 0.01, d * 0.7, M.satin(), vents));
    const screen = box(w * 0.4, h * 0.12, 0.02, M.glow('#ff9f43'), 0, h * 0.2, d / 2 + 0.005);
    g.add(screen); leds.push(screen);
    const fan = makeFan(Math.min(w, d) * 0.3, '#9fb4d8', { blades: 7, frame: 'none', ledRing: false });
    fan.rotation.x = -Math.PI / 2; fan.position.set(0, h / 2 - 0.05, 0);
    g.add(fan); spinners.push(fan.userData.spinner);
    g.userData = { kind: 'asic', spinners, leds, blink: [], size: [w, h, d] };
  } else {
    // Open-source single-chip board: PCB, heatsink, 40 mm fan, USB-C power and a small OLED
    g.add(box(1.0, 0.03, 0.7, M.pcbGreen(), 0, 0.015, 0));
    g.add(box(0.5, 0.18, 0.5, M.aluDark(), 0, 0.12, 0));
    const fan = makeFan(0.22, '#5ee7ff', { blades: 7, frame: 'square', ledRing: false });
    fan.rotation.x = -Math.PI / 2; fan.position.set(0, 0.3, 0);
    g.add(fan); spinners.push(fan.userData.spinner);
    const oled = box(0.25, 0.01, 0.13, M.glow('#7dd3fc'), 0.35, 0.04, -0.22);
    g.add(oled); leds.push(oled);
    g.add(box(0.12, 0.05, 0.08, M.alu(), -0.5, 0.04, 0.2));
    g.userData = { kind: 'asic', spinners, leds, blink: [], size: [1.0, 0.45, 0.7] };
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ------------------------------------------------------------------ PSU

export function makePSU(spec, { q = 'new' } = {}) {
  const g = new THREE.Group();
  const spinners = []; const leds = [];
  if (spec.id === 'srv1200p') {
    g.add(box(0.54, 0.4, 2.0, M.alu(), 0, 0, 0, 0.02));
    g.add(box(0.7, 0.06, 0.9, M.pcbGreen(), 0, -0.23, 1.3));
    for (let i = 0; i < 6; i++) g.add(box(0.1, 0.1, 0.12, M.black(), -0.25 + i * 0.1, -0.15, 1.6));
    const fan = makeFan(0.16, '#9fb4d8', { blades: 7, frame: 'none', ledRing: false });
    fan.position.set(0, 0, -1.01); fan.rotation.y = Math.PI;
    g.add(fan); spinners.push(fan.userData.spinner);
  } else {
    const w = 1.5; const h = 0.86; const d = spec.watts >= 1300 ? 2.0 : 1.6;
    g.add(box(w, h, d, q === 'scrap' ? M.rust() : M.black(), 0, 0, 0, 0.03));
    const fan = makeFan(0.6, '#9fb4d8', { blades: 9, frame: 'none', ledRing: false });
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(0, h / 2 + 0.01, 0);
    g.add(fan); spinners.push(fan.userData.spinner);
    const gr = grille(0.62);
    gr.rotation.x = -Math.PI / 2;
    gr.position.set(0, h / 2 + 0.03, 0);
    g.add(gr);
    // Modular sockets on the back
    const sockets = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) sockets.push([-0.55 + i * 0.22, -0.15 + j * 0.22, d / 2 + 0.01]);
    g.add(instancedBoxes(0.16, 0.12, 0.03, M.satin(), sockets));
    g.userData.sockets = sockets.map(([x, y, z]) => new THREE.Vector3(x, y, z + 0.02));
    // Efficiency badge and wattage label
    const badge = box(0.28, 0.28, 0.02, M.glow(RATING_COLOR[spec.rating]), w / 2 - 0.25, h / 2 - 0.2, -d / 2 - 0.01);
    g.add(badge); leds.push(badge);
    const tag = label(`${spec.watts} W`, 0.8, 0.25, { color: '#e6edf7' });
    tag.rotation.y = Math.PI / 2;
    tag.position.set(w / 2 + 0.006, 0, 0);
    g.add(tag);
    g.add(box(0.12, 0.2, 0.04, M.satin(), -w / 2 + 0.2, 0.1, -d / 2 - 0.02));   // power switch
  }
  g.userData = { ...g.userData, kind: 'psu', spinners, leds, size: [1.5, 0.9, 2] };
  if (!g.userData.sockets) g.userData.sockets = [new THREE.Vector3(0, -0.1, 1.15), new THREE.Vector3(0.2, -0.1, 1.15), new THREE.Vector3(-0.2, -0.1, 1.15)];
  return g;
}

// ------------------------------------------------------------------ cables, risers, boot media

/** A sleeved cable following a smooth path through the given points. */
function cable(points, radius = 0.028, material = M.black(), segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()), false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8), material);
  m.castShadow = true;
  return m;
}

/** PCIe riser board: x16 slot the card plugs into, capacitors, power input and a status LED. */
export function makeRiser(spec = { power: '6-pin', fireRisk: 0, id: 'riser009s' }, { broken = false } = {}) {
  const g = new THREE.Group();
  const premium = spec.id === 'riser011pro';
  g.add(box(0.36, 0.035, 0.95, premium ? M.pcb() : M.pcbGreen(), 0, 0, 0));
  g.add(box(0.12, 0.09, 0.9, M.black(), 0.05, 0.06, 0));                         // x16 slot
  const caps = [];
  for (let i = 0; i < 4; i++) caps.push([-0.12, 0.06, -0.32 + i * 0.12]);
  const capMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), M.aluDark(), 4);
  const m4 = new THREE.Matrix4();
  caps.forEach(([x, y, z], i) => capMesh.setMatrixAt(i, m4.makeTranslation(x, y, z)));
  g.add(capMesh);
  // Power input: 6-pin (black) or SATA (with the warning-red housing)
  const sata = spec.power === 'SATA';
  g.add(box(sata ? 0.05 : 0.11, 0.08, sata ? 0.2 : 0.12, sata ? M.plastic('#c2410c') : M.black(), -0.1, 0.06, 0.4));
  g.add(box(0.08, 0.05, 0.12, M.plastic('#e5e7eb'), -0.1, 0.045, -0.4));         // USB 3.0 port
  const led = box(0.03, 0.02, 0.03, M.glow(broken ? '#ff3b3b' : '#38bdf8'), 0.14, 0.03, 0.42);
  g.add(led);
  if (broken) g.add(box(0.2, 0.01, 0.2, M.rust(), -0.08, 0.025, 0.36));          // scorch mark
  g.userData = {
    kind: 'riser', spinners: [], leds: [led],
    usbPort: new THREE.Vector3(-0.1, 0.05, -0.47),
    powerPort: new THREE.Vector3(-0.1, 0.1, 0.48),
    slotTop: 0.105, sata,
  };
  return g;
}

export function makeBoot(spec) {
  const g = new THREE.Group();
  if (spec.style === 'usb') {
    g.add(box(0.22, 0.07, 0.62, M.plastic('#1f2937'), 0, 0, 0, 0.02));
    g.add(box(0.15, 0.05, 0.16, M.alu(), 0, 0, 0.38));
    const led = box(0.04, 0.02, 0.04, M.glow('#22c55e'), 0, 0.04, -0.2);
    g.add(led);
    g.userData = { kind: 'boot', spinners: [], leds: [led] };
  } else if (spec.style === 'ssd') {
    g.add(box(1.0, 0.07, 0.7, M.satin(), 0, 0, 0, 0.02));
    g.add(box(0.2, 0.05, 0.08, M.black(), 0.35, 0, 0.36));
    g.userData = { kind: 'boot', spinners: [], leds: [] };
  } else {
    g.add(box(0.22, 0.02, 0.8, M.pcb(), 0, 0, 0));
    g.add(box(0.18, 0.025, 0.25, M.black(), 0, 0.015, -0.1), box(0.18, 0.025, 0.12, M.black(), 0, 0.015, 0.2));
    g.add(box(0.2, 0.02, 0.06, M.gold(), 0, 0, 0.41));
    g.userData = { kind: 'boot', spinners: [], leds: [] };
  }
  return g;
}

export function makeModKit(spec) {
  const g = new THREE.Group();
  if (spec.id === 'pads') {
    g.add(box(0.9, 0.04, 0.5, M.plastic('#60a5fa'), 0, 0, 0), box(0.9, 0.04, 0.5, M.plastic('#93c5fd'), 0.1, 0.05, 0.15));
  } else {
    for (let i = 0; i < 8; i++) g.add(box(0.14, 0.03, 0.12, M.copper(), (i % 4) * 0.2 - 0.3, 0, Math.floor(i / 4) * 0.18));
  }
  g.userData = { kind: 'mod', spinners: [], leds: [] };
  return g;
}

/** Motherboard on the lower shelf: x1 slots for every riser, RAM, CPU cooler and a 24-pin socket. */
function makeMotherboard(slots) {
  const g = new THREE.Group();
  const W = 2.6; const D = 2.2;
  g.add(box(W, 0.04, D, M.pcb(), 0, 0, 0));
  const slotPos = [];
  for (let i = 0; i < slots; i++) {
    const z = -D / 2 + 0.25 + (i % 6) * ((D - 0.5) / 5);
    const x = -W / 2 + 0.35 + Math.floor(i / 6) * 0.45;
    g.add(box(0.06, 0.06, 0.3, M.black(), x, 0.05, z));
    slotPos.push(new THREE.Vector3(x, 0.09, z));
  }
  g.add(box(0.5, 0.08, 0.5, M.aluDark(), W * 0.18, 0.06, -0.25));                // CPU socket area
  const fan = makeFan(0.22, '#9fb4d8', { blades: 7, frame: 'none', ledRing: false });
  fan.rotation.x = -Math.PI / 2;
  fan.position.set(W * 0.18, 0.32, -0.25);
  g.add(box(0.5, 0.2, 0.5, M.alu(), W * 0.18, 0.18, -0.25), fan);
  g.add(box(0.06, 0.12, 0.7, M.black(), W * 0.42, 0.08, -0.25), box(0.06, 0.12, 0.7, M.black(), W * 0.36, 0.08, -0.25)); // DIMM slots
  g.add(box(0.035, 0.32, 0.66, M.plastic('#1e293b'), W * 0.42, 0.2, -0.25), box(0.035, 0.32, 0.66, M.plastic('#1e293b'), W * 0.36, 0.2, -0.25)); // RAM
  g.add(box(0.12, 0.12, 0.45, M.plastic('#f8fafc'), W / 2 - 0.08, 0.08, 0.5));    // 24-pin ATX
  g.add(box(0.3, 0.25, 0.9, M.satin(), W / 2 - 0.15, 0.15, -D / 2 + 0.6));         // rear I/O
  g.userData = { slotPos, atx: new THREE.Vector3(W / 2 - 0.02, 0.14, 0.5), usb: new THREE.Vector3(W / 2, 0.2, -D / 2 + 0.45), spinners: [fan.userData.spinner] };
  return g;
}

// ------------------------------------------------------------------ open-air GPU rig

/**
 * A complete open-air rig: frame, motherboard, PSUs, a riser under every card,
 * USB riser cables to the motherboard, riser power from the PSU, and PCIe power
 * cables into each card's 8/16-pin sockets.
 */
export function makeRig(frameSpec, gpus, psus, { detail = 'lite', risers = [], boot = null } = {}) {
  const g = new THREE.Group();
  const spinners = []; const leds = [];
  const W = frameSpec.slots * 0.78 + 1.6;
  const D = 4.2; const Hh = 4.6;
  const tube = 0.12;
  const shelfY = 1.55; const riserY = 2.75;
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) g.add(box(tube, Hh, tube, M.anodized(), x, Hh / 2, z));
  for (const y of [0.06, shelfY, Hh]) {
    g.add(box(W, tube, tube, M.anodized(), 0, y, -D / 2), box(W, tube, tube, M.anodized(), 0, y, D / 2));
    g.add(box(tube, tube, D, M.anodized(), -W / 2, y, 0), box(tube, tube, D, M.anodized(), W / 2, y, 0));
  }
  // Riser rails the cards stand on, and the top bar that braces them
  g.add(box(W, 0.08, 0.12, M.anodized(), 0, riserY - 0.06, -0.55), box(W, 0.08, 0.12, M.anodized(), 0, riserY - 0.06, 0.45));
  g.add(box(W, 0.08, 0.12, M.anodized(), 0, Hh - 0.35, 0.1));
  g.add(box(W - 0.2, 0.03, D - 0.3, M.black(), 0, shelfY + 0.07, 0));            // lower shelf plate

  // Motherboard on the shelf
  const mobo = makeMotherboard(frameSpec.slots);
  mobo.position.set(W / 2 - 1.5, shelfY + 0.12, 0.2);
  g.add(mobo);
  spinners.push(...mobo.userData.spinners);
  const status = box(0.12, 0.06, 0.06, M.glow('#33ff88'), W / 2 - 0.4, shelfY + 0.2, -0.95);
  g.add(status); leds.push(status);

  // PSUs on the floor tier
  const psuModels = psus.map((p, i) => {
    const m = makePSU(p.spec, { q: p.q });
    m.position.set(-W / 2 + 1.0 + i * 1.8, 0.55, -0.6);
    g.add(m);
    spinners.push(...m.userData.spinners); leds.push(...m.userData.leds);
    return m;
  });
  const psuSocket = (i, k) => {
    const m = psuModels[i % psuModels.length];
    if (!m) return null;
    m.updateMatrix();
    return m.userData.sockets[k % m.userData.sockets.length].clone().applyMatrix4(m.matrix);
  };

  // 24-pin from the first PSU to the motherboard
  if (psuModels.length) {
    mobo.updateMatrix();
    const atx = mobo.userData.atx.clone().applyMatrix4(mobo.matrix);
    const from = psuSocket(0, 11);
    g.add(cable([from, from.clone().add(new THREE.Vector3(0, 0, 0.5)), new THREE.Vector3(atx.x + 0.4, atx.y - 0.3, atx.z + 0.6), atx], 0.07, M.black()));
  }
  // Boot drive plugged into the motherboard
  if (boot) {
    const b = makeBoot(boot.spec);
    mobo.updateMatrix();
    const port = mobo.userData.usb.clone().applyMatrix4(mobo.matrix);
    if (boot.spec.style === 'usb') { b.position.copy(port).add(new THREE.Vector3(0.3, 0, 0)); b.rotation.y = Math.PI / 2; }
    else if (boot.spec.style === 'nvme') b.position.set(mobo.position.x - 0.4, shelfY + 0.18, mobo.position.z + 0.6);
    else b.position.set(mobo.position.x - 0.5, shelfY + 0.15, -1.4);
    g.add(b); leds.push(...b.userData.leds);
  }

  gpus.forEach((gp, i) => {
    const x = -W / 2 + 0.8 + i * 0.78;
    // Riser board on the rails
    const riserSpec = risers[i]?.spec || { power: '6-pin', id: 'riser009s' };
    const riser = makeRiser(riserSpec, { broken: risers[i]?.broken });
    riser.position.set(x + 0.12, riserY, -0.05);
    g.add(riser); leds.push(...riser.userData.leds);

    // The card, fingers seated in the riser's x16 slot
    const m = makeGPU(gp.spec, { q: gp.q, detail, broken: gp.broken });
    m.rotation.y = -Math.PI / 2;
    const fingers = m.userData.fingers.clone();
    m.updateMatrix();
    const fingerOffset = fingers.clone().applyEuler(m.rotation);
    m.position.set(riser.position.x + 0.05 - fingerOffset.x, riserY + riser.userData.slotTop - fingerOffset.y - 0.02, riser.position.z - fingerOffset.z);
    g.add(m);
    spinners.push(...m.userData.spinners); leds.push(...m.userData.leds);
    m.updateMatrix(); riser.updateMatrix(); mobo.updateMatrix();

    // USB 3.0 riser cable: riser -> motherboard x1 slot
    const usbFrom = riser.userData.usbPort.clone().applyMatrix4(riser.matrix);
    const slot = mobo.userData.slotPos[i % mobo.userData.slotPos.length].clone().applyMatrix4(mobo.matrix);
    g.add(cable([usbFrom, usbFrom.clone().add(new THREE.Vector3(0, -0.5, -0.3)), new THREE.Vector3((usbFrom.x + slot.x) / 2, shelfY + 0.6, slot.z - 0.2), slot.clone().add(new THREE.Vector3(0, 0.15, 0)), slot],
      0.02, M.plastic(riserSpec.power === 'SATA' ? '#1e3a8a' : '#2563eb'), 20));

    // Riser power: PSU -> riser 6-pin (or SATA)
    const pwrTo = riser.userData.powerPort.clone().applyMatrix4(riser.matrix);
    const pwrFrom = psuSocket(i, i * 2 + 1);
    if (pwrFrom) {
      g.add(cable([pwrFrom, pwrFrom.clone().add(new THREE.Vector3(0, 0, 0.6)), new THREE.Vector3(pwrTo.x, shelfY + 0.4, pwrTo.z + 0.5), pwrTo.clone().add(new THREE.Vector3(0, -0.3, 0.1)), pwrTo],
        riserSpec.power === 'SATA' ? 0.018 : 0.024, riserSpec.power === 'SATA' ? M.plastic('#facc15') : M.black(), 20));
    }

    // PCIe power: PSU -> each 8/16-pin socket on the card, routed up and over the top
    m.userData.sockets.forEach((sock, k) => {
      const to = sock.pos.clone().applyMatrix4(m.matrix);
      const from = psuSocket(i, i * 2 + k);
      if (!from) return;
      for (let w = 0; w < sock.wires; w++) {
        const off = (w - (sock.wires - 1) / 2) * 0.06;
        g.add(cable([
          from.clone().add(new THREE.Vector3(off, 0, 0)),
          from.clone().add(new THREE.Vector3(off, 0.1, 0.7)),
          new THREE.Vector3(to.x + off - 0.25, shelfY + 0.6, D / 2 - 0.3),
          new THREE.Vector3(to.x + off - 0.25, Hh - 0.1, to.z + 0.1),
          to.clone().add(new THREE.Vector3(off, 0.35, 0)),
          to.clone().add(new THREE.Vector3(off, 0, 0)),
        ], 0.03, M.black(), 28));
      }
    });
  });
  g.userData = { kind: 'rig', spinners, leds, statusLed: status, size: [W, Hh, D] };
  return g;
}

// ------------------------------------------------------------------ racks

export function makeRack(spec, asics) {
  const g = new THREE.Group();
  const spinners = []; const leds = [];
  // Racks hold at most four levels; bigger racks grow sideways into extra bays
  const shelfH = spec.style === 'cabinet' ? 2.65 : 2.75;
  const levels = Math.min(spec.units, 4);
  const bays = Math.ceil(spec.units / levels);
  const BW = 4.6; const W = bays * BW; const D = 3.2; const H = levels * shelfH + 0.4;
  const metal = spec.style === 'shelf' ? M.aluDark() : M.satin();
  const x0 = -W / 2;
  for (let b = 0; b <= bays; b++) for (const z of [-D / 2, D / 2]) g.add(box(0.1, H, 0.1, metal, x0 + b * BW, H / 2, z));
  for (let i = 0; i <= levels; i++) g.add(box(W, 0.06, D, spec.style === 'shelf' ? M.aluDark() : M.black(), 0, 0.1 + i * shelfH, 0));
  if (spec.style === 'cabinet' && spec.id !== 'container') {
    g.add(box(W, H, 0.05, M.black(), 0, H / 2, -D / 2));
    g.add(box(0.05, H, D, M.black(), -W / 2, H / 2, 0), box(0.05, H, D, M.black(), W / 2, H / 2, 0));
    g.add(box(W, 0.1, D, M.black(), 0, H, 0));
  }
  if (spec.id === 'container') {
    // 20 ft steel box: corrugated walls, roof, open doors at one end, exhaust fans on the back wall
    const CW = W + 1.4; const CH = H + 1.0; const CD = D + 2.6;
    const steel = M.plastic('#2f6f8f');
    g.add(box(CW, 0.25, CD, steel, 0, 0.02, 0));
    g.add(box(CW, 0.2, CD, steel, 0, CH, 0));
    g.add(box(CW, CH, 0.12, steel, 0, CH / 2, -CD / 2));
    const ribs = [];
    for (let i = 0; i < Math.floor(CW / 0.5); i++) ribs.push([-CW / 2 + 0.25 + i * 0.5, CH / 2, -CD / 2 - 0.08]);
    g.add(instancedBoxes(0.18, CH - 0.2, 0.06, steel, ribs));
    for (const sx of [-1, 1]) {
      g.add(box(0.12, CH, CD, steel, sx * CW / 2, CH / 2, 0));
      const door = box(0.08, CH - 0.2, CD / 2, steel, sx * (CW / 2 + CD / 4), CH / 2, CD / 2 + 0.02);
      door.rotation.y = sx * 1.3; door.position.set(sx * (CW / 2 + 0.2), CH / 2, CD / 2 + CD / 4 - 0.2);
      g.add(door);
    }
    for (let i = 0; i < bays; i++) {
      const fan = makeFan(0.9, '#9fb4d8', { frame: 'square', ledRing: false, blades: 6 });
      fan.position.set(x0 + BW / 2 + i * BW, CH * 0.6, -CD / 2 + 0.2);
      g.add(fan); spinners.push(fan.userData.spinner);
    }
  }
  // PDU strip with indicator
  const pdu = box(0.15, H * 0.8, 0.15, M.black(), W / 2 - 0.15, H * 0.45, -D / 2 + 0.2);
  g.add(pdu);
  const pduLed = box(0.06, 0.06, 0.05, M.glow('#5ee7ff'), W / 2 - 0.15, H * 0.85, -D / 2 + 0.29);
  g.add(pduLed); leds.push(pduLed);
  asics.forEach((a, i) => {
    const bay = Math.floor(i / levels); const lvl = i % levels;
    const m = makeASIC(a.spec, { q: a.q, broken: a.broken, detail: 'lite' });
    m.rotation.y = Math.PI / 2;
    m.scale.setScalar(Math.min(1, (BW - 0.3) / m.userData.size[0], 2.4 / m.userData.size[1]));
    m.position.set(x0 + BW / 2 + bay * BW, 0.15 + lvl * shelfH + (m.userData.size[1] * m.scale.y) / 2 - 0.25, 0);
    g.add(m);
    spinners.push(...m.userData.spinners); leds.push(...m.userData.leds);
  });
  const footW = spec.id === 'container' ? W + 1.4 : W;
  g.userData = { kind: 'rack', spinners, leds, pduLed, size: [footW, H, D] };
  return g;
}

// ------------------------------------------------------------------ cooling, energy

export function makeCooling(spec) {
  const g = new THREE.Group();
  const spinners = []; const leds = [];
  if (spec.style === 'fan') {
    const big = spec.id === 'exhaust';
    const fan = makeFan(big ? 1.1 : 0.9, '#9fb4d8', { frame: 'square', ledRing: false, blades: 5 });
    fan.position.y = big ? 3 : 1.4;
    g.add(fan); spinners.push(fan.userData.spinner);
    if (!big) g.add(box(1.2, 0.15, 0.8, M.black(), 0, 0.08, 0), box(0.12, 0.6, 0.12, M.black(), 0, 0.4, 0));
  } else if (spec.style === 'ac') {
    const split = spec.id === 'splitac';
    const body = split ? box(3.2, 1.0, 0.8, M.plastic(), 0, 4.2, 0, 0.12) : box(1.4, 2.6, 1.2, M.plastic(), 0, 1.3, 0, 0.12);
    g.add(body);
    const vents = [];
    for (let i = 0; i < 8; i++) vents.push(split ? [0, 3.9, 0.41 + 0 * i] : [0, 2.2 - i * 0.07, 0.61]);
    g.add(instancedBoxes(split ? 2.8 : 1.1, 0.03, 0.02, M.plastic('#c9ced4'), split ? [[0, 3.85, 0.41], [0, 3.95, 0.41]] : vents));
    const display = box(0.3, 0.12, 0.02, M.glow('#5ee7ff'), split ? 1.2 : 0, split ? 4.45 : 2.45, split ? 0.41 : 0.61);
    g.add(display); leds.push(display);
    if (!split) {
      const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.5, -0.6), new THREE.Vector3(0, 2.4, -1.4), new THREE.Vector3(0, 3.4, -1.6)]), 16, 0.18, 10), M.plastic('#d8dde3'));
      g.add(hose);
    }
  } else if (spec.style === 'wall') {
    g.add(box(6, 3, 0.4, M.aluDark(), 0, 2.5, 0));
    for (let i = 0; i < 3; i++) {
      const fan = makeFan(0.85, '#9fb4d8', { frame: 'none', ledRing: false, blades: 6 });
      fan.position.set(-2 + i * 2, 2.5, 0.22);
      g.add(fan); spinners.push(fan.userData.spinner);
      const gr = grille(0.88); gr.position.set(-2 + i * 2, 2.5, 0.28); g.add(gr);
    }
  } else if (spec.style === 'crac') {
    g.add(box(2.4, 5.2, 1.6, M.plastic('#dfe3e8'), 0, 2.6, 0, 0.08));
    const louvres = [];
    for (let i = 0; i < 14; i++) louvres.push([0, 1.0 + i * 0.25, 0.81]);
    g.add(instancedBoxes(2.0, 0.06, 0.03, M.plastic('#aab2bc'), louvres));
    const panel = box(0.7, 0.4, 0.02, M.glow('#5ee7ff'), 0, 4.7, 0.81);
    g.add(panel); leds.push(panel);
    for (let i = 0; i < 2; i++) {
      const fan = makeFan(0.5, '#9fb4d8', { frame: 'none', ledRing: false, blades: 7 });
      fan.rotation.x = -Math.PI / 2;
      fan.position.set(-0.5 + i * 1.0, 5.22, 0);
      g.add(fan); spinners.push(fan.userData.spinner);
    }
  } else if (spec.style === 'evap') {
    // Swamp cooler: wet honeycomb pads on three sides, a big fan blowing out the front
    const big = spec.id === 'evaptower';
    const [w, h, d] = big ? [3.2, 4.4, 3.2] : [1.6, 2.6, 1.4];
    g.add(box(w, h, d, M.plastic('#d7dce2'), 0, h / 2, 0, 0.08));
    const pad = M.plastic('#c79a4a');
    g.add(box(0.04, h * 0.6, d * 0.8, pad, -w / 2 - 0.02, h * 0.5, 0), box(0.04, h * 0.6, d * 0.8, pad, w / 2 + 0.02, h * 0.5, 0));
    g.add(box(w * 0.8, h * 0.6, 0.04, pad, 0, h * 0.5, -d / 2 - 0.02));
    const fan = makeFan(Math.min(w, h) * 0.32, '#9fb4d8', { frame: 'none', ledRing: false, blades: 5 });
    fan.position.set(0, h * 0.55, d / 2 + 0.05);
    g.add(fan); spinners.push(fan.userData.spinner);
    const gr = grille(Math.min(w, h) * 0.34); gr.position.set(0, h * 0.55, d / 2 + 0.1); g.add(gr);
    const lamp = box(0.2, 0.08, 0.02, M.glow('#3fa9ff'), w * 0.3, h * 0.9, d / 2 + 0.01); g.add(lamp); leds.push(lamp);
  } else if (spec.style === 'tank') {
    g.add(box(4.5, 2.2, 2.2, M.satin(), 0, 1.1, 0, 0.06));
    const liquid = box(4.2, 1.6, 1.9, M.liquid(), 0, 1.35, 0);
    g.add(liquid);
    g.add(box(4.5, 0.08, 2.2, M.glass(), 0, 2.25, 0));
    const pump = box(0.3, 0.3, 0.3, M.glow('#3fa9ff'), 2.4, 0.6, 0.8);
    g.add(pump); leds.push(pump);
  }
  g.userData = { kind: 'cooling', spinners, leds };
  return g;
}

export function makeInverter(spec) {
  const g = new THREE.Group();
  const big = spec.kw >= 50;
  g.add(box(big ? 2.2 : 1.1, big ? 3.2 : 1.6, big ? 1.2 : 0.45, M.plastic('#f0f2f5'), 0, big ? 1.6 : 3.0, 0, 0.06));
  const screen = box(0.5, 0.3, 0.02, M.glow('#33ff88'), 0, big ? 2.6 : 3.4, big ? 0.61 : 0.24);
  g.add(screen);
  g.add(box(0.8, 0.1, 0.04, M.glow('#5ee7ff'), 0, big ? 2.2 : 2.7, big ? 0.61 : 0.24));
  g.userData = { kind: 'inverter', spinners: [], leds: [screen], screen };
  return g;
}

export function makeBattery(spec, soc = 0, capacity = 1) {
  const g = new THREE.Group();
  const modules = spec.kwh >= 100 ? 1 : Math.max(1, Math.round(spec.kwh / 5));
  const leds = [];
  if (spec.kwh >= 100) {
    g.add(box(6, 2.6, 2.4, M.plastic('#e9edf1'), 0, 1.3, 0, 0.06));
    for (let i = 0; i < 4; i++) g.add(box(0.05, 2.2, 2.0, M.plastic('#c9ced4'), -2.2 + i * 1.5, 1.3, 1.21));
  } else {
    const color = spec.id === 'lead5' ? '#2f3540' : '#eef1f4';
    for (let i = 0; i < modules; i++) g.add(box(1.4, 0.8, 0.9, M.plastic(color), 0, 0.42 + i * 0.85, 0, 0.05));
  }
  // State-of-charge bar
  const bars = 5;
  const lit = Math.round((capacity ? soc / capacity : 0) * bars);
  for (let i = 0; i < bars; i++) {
    const on = i < lit;
    const m = box(0.16, 0.08, 0.02, on ? M.glow(lit <= 1 ? '#ff4d4d' : '#33ff88') : M.black(), -0.4 + i * 0.2, spec.kwh >= 100 ? 2.2 : 0.62, spec.kwh >= 100 ? 1.22 : 0.46);
    g.add(m); if (on) leds.push(m);
  }
  g.userData = { kind: 'battery', spinners: [], leds };
  return g;
}

export function makeSolar(spec) {
  const g = new THREE.Group();
  const panels = Math.min(40, Math.max(4, Math.round(spec.kwp / 0.55)));
  const cols = Math.min(10, Math.ceil(Math.sqrt(panels * 2)));
  const rows = Math.ceil(panels / cols);
  for (let i = 0; i < panels; i++) {
    const c = i % cols; const r = Math.floor(i / cols);
    const p = new THREE.Group();
    p.add(box(1.1, 0.05, 2.2, M.solar(), 0, 0, 0, 0.01));
    p.add(box(1.14, 0.06, 0.03, M.alu(), 0, 0.01, 1.11), box(1.14, 0.06, 0.03, M.alu(), 0, 0.01, -1.11));
    const cells = [];
    for (let k = 1; k < 6; k++) cells.push([0, 0.03, -1.1 + k * 0.37]);
    p.add(instancedBoxes(1.08, 0.005, 0.012, M.alu(), cells));
    p.position.set(c * 1.2 - (cols * 1.2) / 2, 0.6, -r * 2.4);
    p.rotation.x = 0.45;
    g.add(p);
  }
  g.userData = { kind: 'solar', spinners: [], leds: [], size: [cols * 1.2, 1.4, rows * 2.4] };
  return g;
}

export function makeGenerator() {
  const g = new THREE.Group();
  g.add(box(3.2, 1.9, 1.6, M.plastic('#2f4b3a'), 0, 0.95, 0, 0.08));
  const vents = [];
  for (let i = 0; i < 10; i++) vents.push([-1.2 + i * 0.26, 1.2, 0.81]);
  g.add(instancedBoxes(0.12, 0.9, 0.02, M.black(), vents));
  const exhaust = cylinder(0.1, 0.8, M.aluDark(), 12);
  exhaust.position.set(1.2, 2.2, -0.4);
  g.add(exhaust);
  const panel = box(0.4, 0.3, 0.02, M.glow('#ffb020'), -1.1, 1.5, 0.82);
  g.add(panel);
  g.userData = { kind: 'generator', spinners: [], leds: [panel] };
  return g;
}

/** Any catalog item as a standalone showcase model (used by the spec viewer). */
export function makeShowcase(spec, owned = {}) {
  switch (spec.kind) {
    case 'gpu': return makeGPU(spec, { q: owned.q, broken: owned.broken, detail: 'full' });
    case 'asic': return makeASIC(spec, { q: owned.q, broken: owned.broken, detail: 'full' });
    case 'psu': return makePSU(spec, { q: owned.q });
    case 'frame': return makeRig(spec, [], [], { detail: 'lite' });
    case 'riser': return makeRiser(spec, { broken: owned.broken });
    case 'boot': return makeBoot(spec);
    case 'mod': return makeModKit(spec);
    case 'rack': return makeRack(spec, []);
    case 'cooling': return makeCooling(spec);
    case 'inverter': return makeInverter(spec);
    case 'battery': return makeBattery(spec, spec.kwh * 0.8, spec.kwh);
    case 'solar': return makeSolar(spec);
    case 'generator': return makeGenerator(spec);
    case 'case': return makeMachine(spec, owned.parts || {}, { on: owned.on !== false });
    case 'board': return makeBoardModel(spec);
    case 'cpu': return makeCpuChip(spec);
    case 'ram': return makeRamStick(spec);
    case 'drive': return makeDrive(spec, { broken: owned.broken });
    case 'ups': return makeUps(spec);
    default: return new THREE.Group();
  }
}

// ------------------------------------------------------------------ PCs, servers and NAS

/** CPU package: substrate, heat spreader, model text. Server sockets are bigger. */
export function makeCpuChip(spec) {
  const g = new THREE.Group();
  const big = /LGA3647|LGA4189|SP3|SP5/.test(spec.socket);
  const mid = /LGA2011/.test(spec.socket);
  const [w, d] = big ? [1.4, 2.0] : mid ? [1.2, 1.4] : [1.0, 1.0];
  g.add(box(w, 0.06, d, M.pcbGreen(), 0, 0.03, 0));
  g.add(box(w * 0.82, 0.1, d * 0.82, M.alu(), 0, 0.11, 0, 0.03));
  const t = label(spec.name.replace(/ \(used\)/, ''), w * 0.76, 0.22, { color: '#1b2533' });
  t.rotation.x = -Math.PI / 2; t.position.set(0, 0.162, 0); g.add(t);
  const pads = [];
  for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++) pads.push([-w * 0.4 + i * w * 0.115, -0.005, -d * 0.4 + k * d * 0.115]);
  g.add(instancedBoxes(0.04, 0.01, 0.04, M.gold(), pads));
  g.userData = { kind: 'cpu', spinners: [], leds: [] };
  return g;
}

/** One memory module. SO-DIMMs are short; desktop DDR5 gets a heat spreader. */
export function makeRamStick(spec) {
  const g = new THREE.Group();
  const so = /SO/.test(spec.type);
  const L = so ? 1.4 : 2.6; const H = so ? 0.6 : 0.62;
  g.add(box(L, H, 0.03, M.pcbGreen(), 0, H / 2, 0));
  const chips = /ECC/.test(spec.type) ? 9 : 8;
  const pos = [];
  for (let i = 0; i < chips; i++) pos.push([-L / 2 + 0.12 + i * (L - 0.24) / (chips - 1), H * 0.55, 0.03]);
  g.add(instancedBoxes(Math.min(0.22, (L - 0.3) / chips), H * 0.45, 0.03, M.black(), pos));
  if (!so && !/ECC/.test(spec.type)) {
    g.add(box(L * 0.98, H * 0.8, 0.02, M.satin(), 0, H * 0.55, 0.06), box(L * 0.98, H * 0.8, 0.02, M.satin(), 0, H * 0.55, -0.04));
    if (/DDR5/.test(spec.type)) { const bar = box(L * 0.9, 0.05, 0.1, M.glow('#8b5cf6'), 0, H + 0.03, 0.01); g.add(bar); }
  }
  const pins = [];
  for (let i = 0; i < 30; i++) pins.push([-L / 2 + 0.08 + i * (L - 0.16) / 29, 0.04, 0.018]);
  g.add(instancedBoxes(0.03, 0.07, 0.005, M.gold(), pins));
  const t = label(`${spec.gb} GB ${spec.type.replace('-SO', '')}`, L * 0.5, 0.12, { color: '#e6edf7', bg: '#1b2533' });
  t.position.set(0, H * 0.35, so || /ECC/.test(spec.type) ? 0.05 : 0.075); g.add(t);
  g.userData = { kind: 'ram', spinners: [], leds: [] };
  return g;
}

/** Hard drives, SSDs, NVMe sticks and SAS drives in hot-swap caddies. */
export function makeDrive(spec, { broken = false } = {}) {
  const g = new THREE.Group();
  if (spec.size === 'm2') {
    g.add(box(1.6, 0.03, 0.44, M.pcb(), 0, 0.015, 0));
    for (let i = 0; i < (spec.tb >= 4 ? 4 : 2); i++) g.add(box(0.28, 0.04, 0.3, M.black(), -0.5 + i * 0.32, 0.05, 0));
    g.add(box(0.2, 0.04, 0.24, M.black(), 0.58, 0.05, 0));
    if (spec.cls === 'ssd' && spec.watts >= 7) g.add(box(1.1, 0.06, 0.4, M.satin(), -0.15, 0.09, 0));
    const pins = [];
    for (let i = 0; i < 10; i++) pins.push([0.78, 0.02, -0.18 + i * 0.04]);
    g.add(instancedBoxes(0.06, 0.005, 0.025, M.gold(), pins));
    const t = label(spec.name.replace(/ NVMe.*$/, ''), 0.9, 0.14, { color: '#e6edf7' }); t.rotation.x = -Math.PI / 2; t.position.set(-0.15, spec.watts >= 7 ? 0.125 : 0.075, 0); g.add(t);
  } else if (spec.size === 2.5) {
    const sas = spec.iface === 'sas';
    g.add(box(1.0, 0.14, 1.4, sas ? M.aluDark() : M.plastic(spec.cls === 'enterprisessd' ? '#3b4252' : '#1f2937'), 0, 0.07, 0, 0.02));
    const t = label(`${spec.tb < 1 ? Math.round(spec.tb * 1000) + ' GB' : spec.tb + ' TB'} ${sas ? 'SAS' : 'SSD'}`, 0.8, 0.2, { color: '#e6edf7' });
    t.rotation.x = -Math.PI / 2; t.position.set(0, 0.145, 0); g.add(t);
    if (sas) { // hot-swap caddy with a latch
      g.add(box(1.1, 0.18, 0.12, M.black(), 0, 0.09, 0.76), box(0.9, 0.05, 0.05, M.plastic('#f97316'), 0, 0.12, 0.83));
    }
  } else {
    // 3.5" HDD: cast body, top cover with screws, label, SATA/SAS connector
    g.add(box(1.46, 0.36, 2.0, M.aluDark(), 0, 0.18, 0, 0.03));
    g.add(box(1.38, 0.02, 1.9, M.aluDark(), 0, 0.37, 0));
    const color = { nas: '#b91c1c', surveillance: '#7c3aed', enterprise: '#1e3a8a', desktop: '#0f766e' }[spec.cls] || '#334155';
    const t = label(spec.name.replace(/ \(.*\)$/, ''), 1.2, 0.5, { color: '#ffffff', bg: color, font: 'bold 44px Inter, system-ui, sans-serif' });
    t.rotation.x = -Math.PI / 2; t.position.set(0, 0.385, -0.2); g.add(t);
    const cap = label(`${spec.tb} TB`, 1.2, 0.36, { color: '#e6edf7', bg: '#1b2533' });
    cap.rotation.x = -Math.PI / 2; cap.position.set(0, 0.385, 0.45); g.add(cap);
    g.add(box(0.7, 0.12, 0.05, M.black(), 0.2, 0.12, -1.02));
  }
  if (broken) g.add(box(0.15, 0.15, 0.15, M.glow('#ff3b3b'), 0, 0.5, 0));
  g.userData = { kind: 'drive', spinners: [], leds: [] };
  return g;
}

export function makeUps(spec) {
  const g = new THREE.Group();
  const [w, h, d] = spec.style === 'rack' ? [4.4, 0.9, 2.8] : spec.style === 'tower' ? [1.0, 2.0, 2.2] : [0.9, 1.4, 1.6];
  g.add(box(w, h, d, M.plastic('#1b1e24'), 0, h / 2, 0, 0.05));
  const screen = box(Math.min(0.5, w * 0.4), 0.22, 0.02, M.glow('#5ee7ff'), 0, h * 0.72, d / 2 + 0.01);
  g.add(screen);
  const led = box(0.07, 0.07, 0.02, M.glow('#33ff88'), w * 0.3, h * 0.72, d / 2 + 0.01); g.add(led);
  const t = label(spec.name, Math.min(w * 0.9, 1.6), 0.18, { color: '#9fb4d8' }); t.position.set(0, h * 0.45, d / 2 + 0.01); g.add(t);
  g.userData = { kind: 'ups', spinners: [], leds: [screen, led], blink: [led] };
  return g;
}

/** Motherboard on its own: sockets, DIMM slots, M.2 and SATA ports. */
export function makeBoardModel(spec) {
  const g = new THREE.Group();
  const [W, D] = { mitx: [1.7, 1.7], matx: [2.4, 2.4], atx: [2.4, 3.0], eatx: [3.0, 3.3], server: [3.3, 3.3], integrated: [1.4, 1.4] }[spec.form] || [2.4, 3.0];
  g.add(box(W, 0.04, D, spec.ecc ? M.pcbGreen() : M.pcb(), 0, 0.02, 0));
  const sockets = Math.max(1, spec.cpuSockets || 1);
  const sockW = /3647|4189|SP3|SP5/.test(spec.socket) ? 0.7 : 0.5;
  for (let i = 0; i < sockets; i++) {
    const x = sockets > 1 ? -W * 0.22 + i * W * 0.44 : -W * 0.1;
    g.add(box(sockW, 0.06, sockW * 1.2, M.aluDark(), x, 0.07, -D * 0.15), box(sockW * 0.7, 0.02, sockW * 0.85, M.gold(), x, 0.105, -D * 0.15));
  }
  const slots = Math.min(16, spec.ramSlots || 2);
  for (let i = 0; i < slots; i++) {
    const side = sockets > 1 ? (i % 2 ? 1 : -1) : 1;
    const x = sockets > 1 ? side * (W * 0.05 + Math.floor(i / 2) * 0.09) : W * 0.12 + i * 0.12;
    g.add(box(0.06, 0.1, D * 0.42, M.black(), x, 0.07, -D * 0.15));
  }
  for (let i = 0; i < Math.min(5, spec.m2 || 0); i++) g.add(box(0.9, 0.03, 0.2, M.satin(), -W * 0.15, 0.06, D * 0.1 + i * 0.28));
  for (let i = 0; i < Math.min(10, spec.sata || 0); i++) g.add(box(0.12, 0.08, 0.06, M.black(), W / 2 - 0.12, 0.06, D * 0.15 + i * 0.09));
  g.add(box(0.12, 0.12, 0.45, M.plastic('#f8fafc'), W / 2 - 0.08, 0.08, -D * 0.25));
  g.add(box(0.3, 0.3, 1.0, M.satin(), -W / 2 + 0.15, 0.17, -D / 2 + 0.6));
  if (spec.ecc) { const bmc = box(0.25, 0.04, 0.25, M.black(), W * 0.2, 0.06, D * 0.35); g.add(bmc); }
  g.userData = { kind: 'board', spinners: [], leds: [], size: [W, 0.4, D] };
  return g;
}

/**
 * A whole machine (or an empty case): mini PCs, NAS boxes, towers with a glass side showing
 * the board, cooler, RAM, GPU and drives, and rack servers with front drive bays.
 * `parts` = { board, cpus, ram, drives, gpus, psu } as catalog specs (+ broken flags on drives).
 */
export function makeMachine(spec, parts = {}, { on = true } = {}) {
  const g = new THREE.Group();
  const leds = []; const spinners = [];
  const drives = parts.drives || [];
  const ok = (b) => M.glow(b ? '#ff3b3b' : '#33ff88');
  const style = spec.style;
  if (style === 'nuc' || style === 'tiny') {
    const [w, h, d] = style === 'tiny' ? [1.8, 0.36, 1.8] : [1.2, 0.5, 1.2];
    g.add(box(w, h, d, style === 'tiny' ? M.plastic('#1a1d23') : M.satin(), 0, h / 2, 0, 0.06));
    g.add(box(w * 0.8, 0.01, d * 0.8, M.black(), 0, h + 0.002, 0));
    for (let i = 0; i < 2; i++) g.add(box(0.12, 0.05, 0.02, M.black(), -w * 0.25 + i * 0.18, h * 0.5, d / 2 + 0.005));
    const p = box(0.06, 0.06, 0.02, on ? M.glow('#5ee7ff') : M.black(), w * 0.35, h * 0.5, d / 2 + 0.01); g.add(p); leds.push(p);
  } else if (style.startsWith('nas')) {
    const bays = spec.bays35 || 2;
    const w = 0.42 * bays + 0.5; const h = 1.9; const d = 2.4;
    g.add(box(w, h, d, M.plastic('#15171c'), 0, h / 2, 0, 0.06));
    for (let i = 0; i < bays; i++) {
      const filled = drives.filter((x) => x.size === 3.5)[i];
      const x = -w / 2 + 0.35 + i * 0.42;
      g.add(box(0.36, 1.4, 0.04, filled ? M.plastic('#2a2f38') : M.black(), x, 0.95, d / 2 + 0.02));
      const led = box(0.05, 0.05, 0.02, filled ? ok(filled.broken) : M.black(), x, 1.55, d / 2 + 0.05);
      g.add(led); if (filled) leds.push(led);
    }
    const pwr = box(0.08, 0.08, 0.02, on ? M.glow('#5ee7ff') : M.black(), w / 2 - 0.12, 1.7, d / 2 + 0.03); g.add(pwr); leds.push(pwr);
    const fan = makeFan(0.55, '#9fb4d8', { frame: 'none', ledRing: false, blades: 7 });
    fan.rotation.y = Math.PI; fan.position.set(0, 0.95, -d / 2 - 0.02); g.add(fan); spinners.push(fan.userData.spinner);
  } else if (style.startsWith('rack')) {
    const U = spec.rackU || 1; const w = 4.4; const h = 0.44 * U; const d = 3.2;
    g.add(box(w, h, d, M.aluDark(), 0, h / 2, 0, 0.02));
    g.add(box(0.15, h, 0.08, M.satin(), -w / 2 - 0.05, h / 2, d / 2), box(0.15, h, 0.08, M.satin(), w / 2 + 0.05, h / 2, d / 2));
    const bays35 = spec.bays35 || 0; const bays25 = spec.bays25 || 0;
    const total = bays35 + bays25;
    const per = bays35 ? Math.ceil(bays35 / Math.max(1, U)) : Math.ceil(bays25 / Math.max(1, U === 1 ? 1 : 2));
    const rows = Math.ceil(total / per);
    const bw = (w * 0.8) / per; const bh = Math.min(0.4, (h - 0.06) / rows);
    const frontDrives = drives.filter((x) => x.size !== 'm2');
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / per); const c = i % per;
      const filled = frontDrives[i];
      const x = -w * 0.4 + bw / 2 + c * bw; const y = h - 0.03 - bh / 2 - r * bh;
      g.add(box(bw * 0.9, bh * 0.85, 0.05, filled ? M.black() : M.satin(), x, y, d / 2 + 0.02));
      if (filled) { const led = box(0.04, 0.04, 0.02, ok(filled.broken), x + bw * 0.35, y, d / 2 + 0.06); g.add(led); leds.push(led); }
    }
    const pwr = box(0.08, 0.08, 0.02, on ? M.glow('#5ee7ff') : M.black(), w / 2 - 0.15, h / 2, d / 2 + 0.03); g.add(pwr); leds.push(pwr);
    const t = label(spec.name.replace(/ \(used\)/, ''), 1.6, 0.16, { color: '#c3cad3' }); t.position.set(w / 2 - 1.1, Math.max(0.12, h - 0.15), d / 2 + 0.03); if (U > 1) g.add(t);
  } else {
    // Tower: glass on the +X side so the build is visible
    const big = style === 'towerBig';
    const w = 1.2; const h = big ? 3.0 : 2.4; const d = big ? 2.8 : 2.4;
    const frame = style === 'towerWood' ? M.satin() : M.black();
    g.add(box(0.05, h, d, M.satin(), -w / 2, h / 2, 0), box(w, 0.05, d, frame, 0, 0.025, 0), box(w, 0.05, d, frame, 0, h - 0.025, 0), box(w, h, 0.05, frame, 0, h / 2, -d / 2));
    if (style === 'towerWood') {
      const slats = [];
      for (let i = 0; i < 8; i++) slats.push([-w / 2 + 0.1 + i * (w - 0.2) / 7, h / 2, d / 2]);
      g.add(box(w, h, 0.04, M.black(), 0, h / 2, d / 2 - 0.03), instancedBoxes(0.08, h * 0.95, 0.06, M.plastic('#8b5a2b'), slats));
    } else g.add(box(w, h, 0.05, M.black(), 0, h / 2, d / 2));
    const glass = box(0.02, h * 0.97, d * 0.97, M.glass(), w / 2, h / 2, 0); g.add(glass);
    // PSU shroud
    g.add(box(w - 0.1, 0.5, d - 0.1, M.satin(), 0, 0.3, 0));
    if (parts.board) {
      const b = makeBoardModel(parts.board);
      b.rotation.z = Math.PI / 2; b.position.set(-w / 2 + 0.06, h * 0.55, 0); b.scale.setScalar(Math.min(1, (h - 0.7) / b.userData.size[0], (d - 0.2) / b.userData.size[2]) * 0.9);
      g.add(b);
      if ((parts.cpus || []).length) {
        const cooler = box(0.5, 0.6, 0.6, M.alu(), -w / 2 + 0.35, h * 0.6, -d * 0.08);
        const fan = makeFan(0.28, '#9fb4d8', { frame: 'square', ledRing: false, blades: 7 });
        fan.rotation.y = Math.PI / 2; fan.position.set(-w / 2 + 0.66, h * 0.6, -d * 0.08);
        g.add(cooler, fan); spinners.push(fan.userData.spinner);
      }
      (parts.ram || []).slice(0, 4).forEach((r, i) => g.add(box(0.12, 0.05, 0.62, M.plastic('#1e293b'), -w / 2 + 0.16, h * 0.62 + 0.35 + i * 0.07, d * 0.18)));
    }
    (parts.gpus || []).slice(0, 2).forEach((gp, i) => {
      const card = makeGPU(gp, { detail: 'lite' });
      // Horizontal in the PCIe slot: length front-to-back, fans facing down, bracket at the back.
      card.rotation.set(Math.PI / 2, Math.PI / 2, 0, 'YXZ');
      const sc = Math.min(0.62, (d - 0.4) / card.userData.size[0], (w - 0.25) / card.userData.size[1]);
      card.scale.setScalar(sc);
      card.position.set(-w / 2 + 0.12 + (card.userData.size[1] * sc) / 2, h * 0.36 + 0.05 - i * 0.22, 0.05);
      g.add(card); spinners.push(...(card.userData.spinners || []));
    });
    // Drive cage at the front, under the shroud line
    drives.filter((x) => x.size === 3.5).slice(0, big ? 8 : 3).forEach((dv, i) => {
      g.add(box(0.75, 0.16, 0.6, M.aluDark(), 0, 0.12 + i * 0.2 + (i >= 2 ? h * 0.35 : 0), d / 2 - 0.4));
    });
    const fan = makeFan(0.35, '#9fb4d8', { frame: 'square', ledRing: style === 'towerGlass', blades: 7 });
    fan.position.set(0, h * 0.7, -d / 2 + 0.06); g.add(fan); spinners.push(fan.userData.spinner);
    const pwr = box(0.06, 0.06, 0.02, on ? M.glow('#5ee7ff') : M.black(), 0.4, h - 0.1, d / 2 + 0.01); g.add(pwr); leds.push(pwr);
  }
  g.userData = { kind: 'machine', spinners, leds, blink: leds.slice(0, 1) };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
