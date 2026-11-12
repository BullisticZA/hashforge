// The 3D mining room: lighting, post-processing, layout and animation.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { byId } from '../data/catalog.js';
import {
  makeRig, makeRack, makeCooling, makeInverter, makeBattery, makeSolar, makeGenerator,
} from './models.js';

function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3e45';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 50 + Math.random() * 30;
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = 'rgba(20,22,26,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class MiningRoom {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#06090f');
    this.scene.fog = new THREE.Fog('#06090f', 40, 120);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.camera.position.set(14, 12, 18);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 90;
    this.controls.target.set(0, 2, 0);

    // Lighting: cool ceiling strips, warm key light, coloured accent that reacts to heat.
    this.hemi = new THREE.HemisphereLight('#9fc7ff', '#1a1208', 0.35);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#fff3e0', 1.6);
    this.key.position.set(12, 22, 10);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -40; this.key.shadow.camera.right = 40;
    this.key.shadow.camera.top = 40; this.key.shadow.camera.bottom = -40;
    this.key.shadow.bias = -0.0004;
    this.scene.add(this.key);
    this.heatLight = new THREE.PointLight('#5ee7ff', 30, 40, 1.6);
    this.heatLight.position.set(0, 6, 0);
    this.scene.add(this.heatLight);
    this.emergency = new THREE.PointLight('#ff2a2a', 0, 60, 1.2);
    this.emergency.position.set(0, 7, 0);
    this.scene.add(this.emergency);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.4, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.roomGroup = new THREE.Group();
    this.equipment = new THREE.Group();
    this.scene.add(this.roomGroup, this.equipment);
    this.spinners = []; this.leds = []; this.blinkers = []; this.pickables = [];
    this.layoutKey = '';
    this.fanSpeed = 1; this.online = true;
    this.clock = new THREE.Clock();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.renderer.domElement.addEventListener('pointerdown', (e) => { this.downAt = [e.clientX, e.clientY]; });
    this.renderer.domElement.addEventListener('pointerup', (e) => this.handleClick(e));
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.container.clientWidth || 1; const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  handleClick(e) {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && !o.userData.pick) o = o.parent;
    if (o && this.onSelect) this.onSelect(o.userData.pick);
  }

  buildRoom(loc) {
    this.roomGroup.clear();
    const { w, d } = loc;
    const tex = concreteTexture();
    tex.repeat.set(w / 4, d / 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: loc.id === 'bedroom' ? '#2b3140' : '#22262d', roughness: 0.85 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 9, 0.3), wallMat);
    back.position.set(0, 4.5, -d / 2); back.receiveShadow = true;
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, d), wallMat);
    side.position.set(-w / 2, 4.5, 0); side.receiveShadow = true;
    this.roomGroup.add(back, side);
    // Ceiling light strips
    this.ceilingStrips = [];
    for (let i = 0; i < Math.max(2, Math.floor(w / 8)); i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, d * 0.7),
        new THREE.MeshStandardMaterial({ color: '#dff4ff', emissive: '#dff4ff', emissiveIntensity: 1.6, toneMapped: false }));
      strip.position.set(-w / 2 + (i + 0.5) * (w / Math.max(2, Math.floor(w / 8))), 8.95, 0);
      this.roomGroup.add(strip);
      this.ceilingStrips.push(strip);
    }
    // Cable tray along the back wall
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: '#4a5260', metalness: 0.8, roughness: 0.4 }));
    tray.position.set(0, 7.2, -d / 2 + 0.5);
    this.roomGroup.add(tray);
    // Floor grid accent
    const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d) / 2, '#1d3a55', '#14202e');
    grid.position.y = 0.01;
    grid.material.opacity = 0.35; grid.material.transparent = true;
    this.roomGroup.add(grid);
    this.key.shadow.camera.left = -w; this.key.shadow.camera.right = w;
    this.key.shadow.camera.top = d; this.key.shadow.camera.bottom = -d;
    this.key.shadow.camera.updateProjectionMatrix();
  }

  /** Rebuild 3D equipment only when the set of hardware changes. */
  sync(state, room, loc) {
    const key = JSON.stringify([
      loc.id,
      state.rigs.map((r) => [r.uid, r.frameId, r.gpus.map((g) => g.id + g.q + g.broken), r.psus.map((p) => p.id), (r.risers || []).map((x) => x.id + x.broken), r.boot?.id]),
      state.racks.map((r) => [r.uid, r.id, r.asics.map((a) => a.id + a.q + a.broken)]),
      state.cooling.map((c) => c.id),
      state.energy.inverters.map((i) => i.id), state.energy.batteries.map((b) => [b.id, Math.round((b.soc || 0) / byId[b.id].kwh * 5)]),
      state.energy.solar.map((s) => s.id), state.energy.generators.map((g) => g.id),
    ]);
    if (key !== this.layoutKey) {
      if (!this.layoutKey.startsWith(`["${loc.id}"`)) {
        this.buildRoom(loc);
        this.frameCamera(loc);
      }
      this.layoutKey = key;
      this.layout(state, loc);
    }
    this.applyLive(state, room);
  }

  frameCamera(loc) {
    const s = Math.max(loc.w, loc.d);
    this.camera.position.set(s * 0.95, s * 0.85, s * 1.25);
    this.controls.target.set(0, 2, -loc.d * 0.1);
  }

  layout(state, loc) {
    this.equipment.clear();
    this.spinners = []; this.leds = []; this.blinkers = []; this.pickables = [];
    const totalGpus = state.rigs.reduce((s, r) => s + r.gpus.length, 0);
    const detail = totalGpus > 24 ? 'lite' : 'full';
    const add = (obj, pick) => {
      if (pick) { obj.userData.pick = pick; this.pickables.push(obj); }
      this.equipment.add(obj);
      this.spinners.push(...(obj.userData.spinners || []));
      this.leds.push(...(obj.userData.leds || []));
      this.blinkers.push(...(obj.userData.blink || []));
    };
    // Rigs in rows across the room
    let x = -loc.w / 2 + 3.5; let z = -loc.d / 2 + 3;
    state.rigs.forEach((rig) => {
      const frame = byId[rig.frameId];
      const width = frame.slots * 0.78 + 1.6;
      if (x + width > loc.w / 2 - 1) { x = -loc.w / 2 + 3.5; z += 5.5; }
      const m = makeRig(frame, rig.gpus.map((g) => ({ spec: byId[g.id], q: g.q, broken: g.broken })),
        rig.psus.map((p) => ({ spec: byId[p.id], q: p.q })), {
          detail,
          risers: (rig.risers || []).map((r) => ({ spec: byId[r.id], broken: r.broken })),
          boot: rig.boot ? { spec: byId[rig.boot.id] } : null,
        });
      m.position.set(x + width / 2, 0, z);
      add(m, { type: 'rig', uid: rig.uid });
      x += width + 1.2;
    });
    // Racks along the left wall
    state.racks.forEach((rack, i) => {
      const m = makeRack(byId[rack.id], rack.asics.map((a) => ({ spec: byId[a.id], q: a.q, broken: a.broken })));
      m.rotation.y = Math.PI / 2;
      m.position.set(-loc.w / 2 + 2.2, 0, -loc.d / 2 + 3 + i * 5.2);
      add(m, { type: 'rack', uid: rack.uid });
    });
    // Cooling on the right
    state.cooling.forEach((c, i) => {
      const m = makeCooling(byId[c.id]);
      const wallUnit = ['splitac', 'industrial', 'exhaust'].includes(c.id);
      if (wallUnit) m.position.set(loc.w / 2 - 6 - i * 3, 0, -loc.d / 2 + 0.6);
      else { m.position.set(loc.w / 2 - 1.5, 0, -loc.d / 2 + 3 + i * 2.6); m.rotation.y = -Math.PI / 2; }
      add(m, { type: 'cooling', uid: c.uid });
    });
    // Energy corner: inverters on the wall, batteries and generator below, solar on the roof
    const ex = loc.w / 2 - 2; const ez = loc.d / 2 - 2;
    state.energy.inverters.forEach((inv, i) => {
      const m = makeInverter(byId[inv.id]); m.position.set(ex - i * 1.6, 0, ez); m.rotation.y = -Math.PI * 0.75;
      add(m, { type: 'energy', uid: inv.uid });
    });
    state.energy.batteries.forEach((b, i) => {
      const spec = byId[b.id];
      const m = makeBattery(spec, b.soc || 0, spec.kwh * (1 - (b.wear || 0)));
      m.position.set(ex - 1.8 - i * 1.8, 0, ez - 0.4);
      add(m, { type: 'energy', uid: b.uid });
    });
    state.energy.generators.forEach((gen, i) => {
      const m = makeGenerator(byId[gen.id]); m.position.set(ex - 3 - i * 4, 0, ez - 4); add(m, { type: 'energy', uid: gen.uid });
    });
    state.energy.solar.forEach((s, i) => {
      const m = makeSolar(byId[s.id]);
      m.scale.setScalar(0.6);
      m.position.set(-loc.w / 4 + i * 8, 9.6, -loc.d / 2 + 2);
      add(m, { type: 'energy', uid: s.uid });
    });
  }

  /** Per-frame state: fan speeds, LED colours, heat tint and outage lighting. */
  applyLive(state, room) {
    this.online = !room.offline;
    this.fanSpeed = this.online && room.minerWatts > 0 ? 0.6 + 0.4 * Math.min(1, Math.max(0, (room.deviceTemp - 50) / 40)) : 0;
    const t = Math.min(1, Math.max(0, (room.deviceTemp - 55) / 40));
    this.heatLight.color.setRGB(0.37 + 0.63 * t, 0.9 - 0.65 * t, 1 - 0.85 * t);
    this.heatLight.intensity = room.minerWatts > 0 ? 6 + 18 * t : 2;
    const dark = room.offline;
    this.key.intensity = dark ? 0.12 : 1.2;
    this.hemi.intensity = dark ? 0.06 : 0.35;
    (this.ceilingStrips || []).forEach((s) => { s.material.emissiveIntensity = dark ? 0.02 : 1.6; });
    this.leds.forEach((l) => { l.visible = !dark; });
    this.emergencyOn = dark;
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    for (const s of this.spinners) s.rotation.z += dt * 28 * this.fanSpeed;
    for (const b of this.blinkers) b.visible = this.online && Math.sin(time * 9 + b.id) > 0;
    this.emergency.intensity = this.emergencyOn ? 40 * (0.6 + 0.4 * Math.sin(time * 3)) : 0;
    this.controls.update();
    this.composer.render();
  }
}
