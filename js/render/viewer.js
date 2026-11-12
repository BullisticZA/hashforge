// Product viewer: one piece of hardware on a turntable, with an exploded view for GPUs.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeShowcase } from './models.js';

export class ProductViewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = this.backdrop();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 1.2;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.6;
    const key = new THREE.DirectionalLight('#ffffff', 3.0);
    key.position.set(4, 8, 6); key.castShadow = true;
    const rim = new THREE.DirectionalLight('#5ee7ff', 1.4);
    rim.position.set(-6, 3, -6);
    const fill = new THREE.DirectionalLight('#8b5cf6', 0.8);
    fill.position.set(-4, -2, 6);
    this.scene.add(key, rim, fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.floor = floor;
    this.scene.add(floor);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.35, 0.92));
    this.composer.addPass(new OutputPass());
    this.explodeTarget = 0; this.explodeNow = 0;
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  backdrop() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#16233d'); g.addColorStop(0.6, '#0b1222'); g.addColorStop(1, '#05070d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  resize() {
    const w = this.container.clientWidth || 1; const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  show(spec, owned = {}) {
    if (this.model) this.scene.remove(this.model);
    this.model = makeShowcase(spec, owned);
    this.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.sub(center);
    this.model.position.y += size.y / 2;
    const pivot = new THREE.Group();
    pivot.add(this.model);
    if (spec.kind === 'gpu') pivot.rotation.x = -0.25;
    this.scene.add(pivot);
    if (this.pivot) this.scene.remove(this.pivot);
    this.pivot = pivot;
    this.model = pivot;
    this.inner = pivot.children[0];
    this.floor.position.y = -0.01;
    const radius = Math.max(size.x, size.y, size.z);
    this.camera.position.set(radius * 0.55, radius * 0.45, radius * 0.95);
    this.controls.target.set(0, size.y / 2, 0);
    this.explodeTarget = 0; this.explodeNow = 0;
    this.canExplode = !!this.inner.userData.explode;
  }

  setExploded(on) { this.explodeTarget = on ? 1 : 0; }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.inner) {
      for (const s of this.inner.userData.spinners || []) s.rotation.z += dt * 18;
      if (this.canExplode) {
        this.explodeNow += (this.explodeTarget - this.explodeNow) * Math.min(1, dt * 5);
        for (const [name, offset] of Object.entries(this.inner.userData.explode)) {
          this.inner.userData.layers[name].position.z = offset * this.explodeNow;
        }
      }
    }
    this.controls.update();
    this.composer.render();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
