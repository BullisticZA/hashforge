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
  plastic: (c = '#e9ecef') => mat(`plastic${c}`, () => new THREE.MeshStandardMaterial({ color: c, metalness: 0.05, roughness: 0.5 })),
  rubber: () => mat('rubber', () => new THREE.MeshStandardMaterial({ color: '#1d1f23', roughness: 0.9 })),
  glow: (c) => mat(`glow${c}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.15, toneMapped: false })),
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: '#9fd8ff', metalness: 0, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.25 })),
  solar: () => mat('solar', () => new THREE.MeshPhysicalMaterial({ color: '#0e1d3f', metalness: 0.6, roughness: 0.15, clearcoat: 1 })),
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
  const T = spec.fans >= 3 ? 0.62 : spec.fans === 2 ? 0.5 : 0.42;
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
  if (detail === 'full') {
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

  // Fans
  const fanR = Math.min(H * 0.43, (L - 0.4) / (spec.fans * 2.05));
  for (let i = 0; i < spec.fans; i++) {
    const fan = makeFan(fanR, accent, { blades: detail === 'full' ? 11 : 7, ledRing: detail === 'full' });
    const x = -L / 2 + 0.25 + (L - 0.5) * ((i + 0.5) / spec.fans);
    fan.position.set(x + 0.1, 0, T / 2 + 0.005);
    layers.fans.add(fan);
    spinners.push(fan.userData.spinner);
    if (fan.userData.leds) leds.push(...fan.userData.leds);
  }

  // I/O bracket with display outputs, and power connectors on the top edge
  const bracket = new THREE.Group();
  bracket.add(box(0.03, H * 1.08, T + 0.05, M.alu(), -L / 2 - 0.03, 0.03, 0));
  if (detail === 'full') {
    for (let i = 0; i < 4; i++) bracket.add(box(0.035, 0.09, 0.16, M.black(), -L / 2 - 0.045, -0.35 + i * 0.2, -T / 2 + 0.15));
    const holes = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) holes.push([-L / 2 - 0.045, 0.15 + i * 0.09, j * 0.12]);
    bracket.add(instancedBoxes(0.035, 0.05, 0.08, M.black(), holes));
  }
  layers.pcb.add(bracket);
  const connectors = spec.tdp > 400 ? [['16pin', 0.32]] : spec.tdp > 220 ? [['8pin', 0.22], ['8pin', 0.22]] : spec.tdp > 150 ? [['8pin', 0.22]] : [['6pin', 0.17]];
  connectors.forEach(([, w], i) => {
    const c = box(w, 0.11, 0.1, M.black(), L * 0.3 - i * 0.27, H / 2 + 0.05, -T / 2 + 0.12);
    layers.pcb.add(c);
  });

  if (broken) {
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: '#555', transparent: true, opacity: 0.35 }));
    smoke.position.set(0, H / 2 + 0.3, 0);
    root.add(smoke);
  }

  // Exploded view offsets (along Z, front to back)
  root.userData = {
    kind: 'gpu', spinners, leds, layers, size: [L, H, T],
    explode: { backplate: -0.9, pcb: -0.45, heatsink: 0, shroud: 0.55, fans: 1.0 },
  };
  return root;
}

// ------------------------------------------------------------------ ASIC miner

export function makeASIC(spec, { q = 'new', broken = false, detail = 'full' } = {}) {
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
    // Efficiency badge and wattage label
    const badge = box(0.28, 0.28, 0.02, M.glow(RATING_COLOR[spec.rating]), w / 2 - 0.25, h / 2 - 0.2, -d / 2 - 0.01);
    g.add(badge); leds.push(badge);
    const tag = label(`${spec.watts} W`, 0.8, 0.25, { color: '#e6edf7' });
    tag.rotation.y = Math.PI / 2;
    tag.position.set(w / 2 + 0.006, 0, 0);
    g.add(tag);
    g.add(box(0.12, 0.2, 0.04, M.satin(), -w / 2 + 0.2, 0.1, -d / 2 - 0.02));   // power switch
  }
  g.userData = { kind: 'psu', spinners, leds, size: [1.5, 0.9, 2] };
  return g;
}

// ------------------------------------------------------------------ open-air GPU rig

export function makeRig(frameSpec, gpus, psus, { detail = 'lite' } = {}) {
  const g = new THREE.Group();
  const spinners = []; const leds = [];
  const W = frameSpec.slots * 0.78 + 1.2;
  const D = 4.2; const Hh = 4.2;
  const tube = 0.12;
  // Aluminium extrusion frame
  const rails = [];
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) rails.push(box(tube, Hh, tube, M.alu(), x, Hh / 2, z));
  for (const y of [0.06, 1.6, Hh]) {
    rails.push(box(W, tube, tube, M.alu(), 0, y, -D / 2), box(W, tube, tube, M.alu(), 0, y, D / 2));
    rails.push(box(tube, tube, D, M.alu(), -W / 2, y, 0), box(tube, tube, D, M.alu(), W / 2, y, 0));
  }
  rails.push(box(W, tube, tube, M.alu(), 0, Hh - 0.5, 0.4));   // GPU support bar
  g.add(...rails);
  // Motherboard tray on the lower level
  g.add(box(W * 0.5, 0.04, 2.4, M.aluDark(), W * 0.18, 1.62, -0.6));
  g.add(box(2.4, 0.05, 2.0, M.pcb(), W * 0.18, 1.67, -0.6));
  g.add(box(0.5, 0.25, 0.5, M.black(), W * 0.18, 1.82, -0.8));        // CPU cooler
  const status = box(0.12, 0.06, 0.06, M.glow('#33ff88'), W * 0.18 + 0.9, 1.72, 0.3);
  g.add(status); leds.push(status);
  // PSUs on the lower shelf
  psus.forEach((p, i) => {
    const m = makePSU(p.spec, { q: p.q });
    m.position.set(-W / 2 + 1.0 + i * 1.8, 0.55, -0.4);
    g.add(m);
    spinners.push(...m.userData.spinners); leds.push(...m.userData.leds);
  });
  // GPUs standing vertically on top, fans facing +X
  gpus.forEach((gp, i) => {
    const m = makeGPU(gp.spec, { q: gp.q, detail, broken: gp.broken });
    m.rotation.y = -Math.PI / 2;           // length along Z
    m.rotation.x = 0;
    m.position.set(-W / 2 + 0.75 + i * 0.78, Hh - 0.2 - 0.62, 0.3);
    g.add(m);
    spinners.push(...m.userData.spinners); leds.push(...m.userData.leds);
    // PCIe riser cable down to the motherboard
    const riser = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-W / 2 + 0.75 + i * 0.78, Hh - 1.4, 0.4),
      new THREE.Vector3(-W / 2 + 0.75 + i * 0.78, 2.6, 0.2),
      new THREE.Vector3(W * 0.18 - 0.8 + i * 0.15, 1.75, -0.2),
    ]), 12, 0.025, 6), M.plastic('#2b6cff'));
    g.add(riser);
  });
  g.userData = { kind: 'rig', spinners, leds, statusLed: status, size: [W, Hh, D] };
  return g;
}

// ------------------------------------------------------------------ racks

export function makeRack(spec, asics) {
  const g = new THREE.Group();
  const spinners = []; const leds = [];
  const perShelf = 1;
  const shelfH = spec.style === 'cabinet' ? 2.65 : 2.75;
  const levels = Math.ceil(spec.units / perShelf);
  const W = 4.6; const D = 3.2; const H = levels * shelfH + 0.4;
  const metal = spec.style === 'shelf' ? M.aluDark() : M.satin();
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) g.add(box(0.1, H, 0.1, metal, x, H / 2, z));
  for (let i = 0; i <= levels; i++) g.add(box(W, 0.06, D, spec.style === 'shelf' ? M.aluDark() : M.black(), 0, 0.1 + i * shelfH, 0));
  if (spec.style === 'cabinet') {
    g.add(box(W, H, 0.05, M.black(), 0, H / 2, -D / 2));
    g.add(box(0.05, H, D, M.black(), -W / 2, H / 2, 0), box(0.05, H, D, M.black(), W / 2, H / 2, 0));
    g.add(box(W, 0.1, D, M.black(), 0, H, 0));
  }
  // PDU strip with indicator
  const pdu = box(0.15, H * 0.8, 0.15, M.black(), W / 2 - 0.15, H * 0.45, -D / 2 + 0.2);
  g.add(pdu);
  const pduLed = box(0.06, 0.06, 0.05, M.glow('#5ee7ff'), W / 2 - 0.15, H * 0.85, -D / 2 + 0.29);
  g.add(pduLed); leds.push(pduLed);
  asics.forEach((a, i) => {
    const m = makeASIC(a.spec, { q: a.q, broken: a.broken, detail: 'lite' });
    m.rotation.y = Math.PI / 2;
    m.scale.setScalar(Math.min(1, (W - 0.3) / m.userData.size[0], 2.4 / m.userData.size[1]));
    m.position.set(0, 0.15 + i * shelfH + (m.userData.size[1] * m.scale.y) / 2 - 0.25, 0);
    g.add(m);
    spinners.push(...m.userData.spinners); leds.push(...m.userData.leds);
  });
  g.userData = { kind: 'rack', spinners, leds, pduLed, size: [W, H, D] };
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
  const panels = Math.max(4, Math.round(spec.kwp / 0.55));
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
    p.position.set(c * 1.2 - (cols * 1.2) / 2, r * 0.8, -r * 2.0);
    p.rotation.x = -0.45;
    g.add(p);
  }
  g.userData = { kind: 'solar', spinners: [], leds: [], size: [cols * 1.2, rows, rows * 2.3] };
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
    case 'rack': return makeRack(spec, []);
    case 'cooling': return makeCooling(spec);
    case 'inverter': return makeInverter(spec);
    case 'battery': return makeBattery(spec, spec.kwh * 0.8, spec.kwh);
    case 'solar': return makeSolar(spec);
    case 'generator': return makeGenerator(spec);
    default: return new THREE.Group();
  }
}
