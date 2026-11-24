/**
 * Hero scene: a stylised Godavari at golden hour (light mode) or night (dark mode).
 *
 *  ┌ sky dome (gradient + sun / moon + stars)            shaders/sky.*.glsl
 *  ├ water plane (vertex waves + fresnel + reflections)   shaders/water.*.glsl
 *  ├ river banks, trees and a small ghat temple (low-poly silhouettes)
 *  ├ floating diyas + lotuses, bobbing on the same wave function as the shader
 *  └ fireflies / golden dust (GPU-animated points)        shaders/fireflies.*.glsl
 *
 * Interaction:
 *  - setPointer(x, y): camera parallax following the mouse / device tilt
 *  - setProgress(p):   0..1 scroll progress through the About section → camera
 *                      travels downstream along the river
 *  - setNight(bool):   animates every palette uniform between day and night
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { createRenderer, RenderLoop, disposeRenderer } from '../core/three-utils.js';
import { water as waterShader, sky as skyShader, fireflies as firefliesShader } from '../shaders/index.js';
import { createDiyaFactory, createLotusFactory } from './props.js';

/* JS mirror of waveHeight() in water.vert.glsl: keep the constants in sync! */
const WAVES = [
  [0.2, 1.0, 0.35, 1.1, 0.18],
  [-0.55, 0.8, 0.55, 1.45, 0.1],
  [0.85, 0.45, 0.9, 1.9, 0.05],
  [-0.15, 1.0, 1.6, 2.6, 0.025],
].map(([dx, dz, f, s, a]) => {
  const l = Math.hypot(dx, dz);
  return { dx: dx / l, dz: dz / l, f, s, a };
});
function waveHeight(x, z, t, amp) {
  let h = 0;
  for (const w of WAVES) h += Math.sin((w.dx * x + w.dz * z) * w.f + t * w.s) * w.a;
  return h * amp;
}

const PALETTE = {
  deepDay: '#0B4F5E', deepNight: '#021820',
  skyTopDay: '#2E7F8F', skyTopNight: '#020B12',
  horizonDay: '#F7C77E', horizonNight: '#0B3442',
};
const SUN_DAY = new THREE.Vector3(0.25, 0.16, -1).normalize();
const SUN_NIGHT = new THREE.Vector3(-0.45, 0.42, -1).normalize();

const Z_SPAN = 90; // floating items live in a window this long ahead of the camera

export class RiverScene {
  constructor(canvas, { observe, quality = 'high', night = false, reduced = false } = {}) {
    this.reduced = reduced;
    this.quality = quality;
    this.renderer = createRenderer(canvas, { alpha: false, antialias: quality === 'high', maxDpr: quality === 'high' ? 2 : 1.5 });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.base = new THREE.Vector3(0, 2.1, 9);
    this.camera.position.copy(this.base);
    this.pointer = new THREE.Vector2();
    this.pointerEased = new THREE.Vector2();
    this.progress = 0;
    this.progressEased = 0;
    this.night = { value: night ? 1 : 0 };

    this.uniforms = {
      uTime: { value: 0 },
      uNight: this.night,
      uAmp: { value: 1 },
      uDeepDay: { value: new THREE.Color(PALETTE.deepDay) },
      uDeepNight: { value: new THREE.Color(PALETTE.deepNight) },
      uSkyTopDay: { value: new THREE.Color(PALETTE.skyTopDay) },
      uSkyTopNight: { value: new THREE.Color(PALETTE.skyTopNight) },
      uHorizonDay: { value: new THREE.Color(PALETTE.horizonDay) },
      uHorizonNight: { value: new THREE.Color(PALETTE.horizonNight) },
      uSunDir: { value: SUN_DAY.clone().lerp(SUN_NIGHT, this.night.value) },
    };

    this.buildSky();
    this.buildWater();
    this.buildBanks();
    this.buildLights();
    this.buildFloaters();
    this.buildFireflies();
    this.applyNight();

    this.loop = new RenderLoop({
      renderer: this.renderer,
      observe,
      manual: reduced,
      onResize: (w, h) => {
        this.camera.aspect = w / h;
        // widen the view on portrait screens so the river still reads
        this.camera.fov = w / h < 0.8 ? 68 : 50;
        this.camera.updateProjectionMatrix();
        this.fireflies && (this.fireflies.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio());
      },
      onFrame: (dt, t) => this.frame(dt, t),
    });
  }

  /* ------------------------------------------------------------ builders */
  buildSky() {
    const geo = new THREE.SphereGeometry(300, 32, 16);
    const mat = new THREE.ShaderMaterial({ ...skyShader, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  buildWater() {
    const seg = this.quality === 'high' ? 220 : 110;
    this.cell = 160 / seg;
    const geo = new THREE.PlaneGeometry(120, 160, seg, seg).rotateX(-Math.PI / 2);
    this.diyaCount = this.quality === 'high' ? 14 : 9;
    const mat = new THREE.ShaderMaterial({
      ...waterShader,
      uniforms: {
        ...this.uniforms,
        uDiyas: { value: Array.from({ length: 16 }, () => new THREE.Vector3(0, -99, 0)) },
        uDiyaCount: { value: this.diyaCount },
        uFogNear: { value: 25 },
        uFogFar: { value: 95 },
      },
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.frustumCulled = false;
    this.scene.add(this.water);
  }

  /** Low-poly banks with trees and a small temple on the ghat (pure silhouettes, cheap). */
  buildBanks() {
    this.banks = new THREE.Group();
    const bankMat = new THREE.MeshStandardMaterial({ color: '#1f4a3a', roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const makeBank = (side) => {
      const geo = new THREE.PlaneGeometry(40, 260, 20, 80).rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const edge = (x + 20) / 40; // 0 at river edge → 1 far away
        const hills = Math.sin(z * 0.08 + side) * 1.6 + Math.sin(z * 0.21 + side * 3) * 0.7 + Math.sin(z * 0.5) * 0.25;
        pos.setY(i, -0.6 + edge * 3.2 + Math.max(0, hills) * edge * 1.4);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, bankMat);
      m.position.set(side * 34, 0, -80);
      m.scale.x = side; // mirror so the low edge always faces the river
      return m;
    };
    this.banks.add(makeBank(1), makeBank(-1));

    // Trees: one instanced cone mesh
    const count = this.quality === 'high' ? 180 : 90;
    const treeGeo = new THREE.ConeGeometry(0.9, 3.2, 6).translate(0, 1.6, 0);
    const treeMat = new THREE.MeshStandardMaterial({ color: '#2d5f3c', roughness: 1, flatShading: true });
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      p.set(side * (16 + Math.random() * 16), 0.8 + Math.random() * 1.5, 12 - Math.random() * 200);
      s.setScalar(0.6 + Math.random() * 1.1);
      m4.compose(p, q, s);
      trees.setMatrixAt(i, m4);
    }
    this.banks.add(trees);

    // Ghat temple far upstream on the left bank: steps + shikhara + flag
    const stone = new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: 0.9, flatShading: true });
    const temple = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(10 - i * 0.6, 0.35, 1.2), stone);
      step.position.set(0, i * 0.35, -i * 0.9);
      temple.add(step);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), stone);
    base.position.set(0, 2.7, -5.5);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 8), stone);
    spire.position.set(0, 5.9, -5.5);
    const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: '#F4A300', emissive: '#F4A300', emissiveIntensity: 0.6 }));
    kalash.position.set(0, 8.3, -5.5);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshBasicMaterial({ color: '#F4A300', side: THREE.DoubleSide }));
    flag.position.set(0.55, 8.9, -5.5);
    this.flag = flag;
    temple.add(base, spire, kalash, flag);
    temple.position.set(-15, -0.2, -60);
    temple.rotation.y = 0.5;
    this.banks.add(temple);

    this.scene.add(this.banks);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#ffe2b0', '#0e5e6f', 1.1);
    this.sun = new THREE.DirectionalLight('#ffd08a', 1.6);
    this.sun.position.copy(SUN_DAY).multiplyScalar(50);
    this.scene.add(this.hemi, this.sun);
    this.scene.fog = new THREE.Fog(PALETTE.horizonDay, 30, 120);
  }

  buildFloaters() {
    this.diyaFactory = createDiyaFactory();
    this.lotusFactory = createLotusFactory();
    this.floaters = [];
    const add = (obj, kind, i, n) => {
      const z = 8 - (i / n) * Z_SPAN + Math.random() * 4;
      const x = (Math.random() - 0.5) * 16;
      obj.position.set(x, 0, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      obj.userData.kind = kind;
      obj.userData.drift = 0.25 + Math.random() * 0.35;
      obj.userData.phase = Math.random() * 10;
      this.scene.add(obj);
      this.floaters.push(obj);
    };
    this.diyas = [];
    for (let i = 0; i < this.diyaCount; i++) {
      const d = this.diyaFactory.create({ seed: Math.random(), intensity: 0.9 });
      d.scale.setScalar(1.15);
      add(d, 'diya', i, this.diyaCount);
      this.diyas.push(d);
    }
    const lotusCount = this.quality === 'high' ? 10 : 6;
    for (let i = 0; i < lotusCount; i++) {
      const l = this.lotusFactory.create();
      l.scale.setScalar(0.9 + Math.random() * 0.5);
      add(l, 'lotus', i + 0.5, lotusCount);
    }
  }

  buildFireflies() {
    const n = this.quality === 'high' ? 520 : 220;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = 0.3 + Math.random() * 5;
      pos[i * 3 + 2] = 6 - Math.random() * 60;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      ...firefliesShader,
      uniforms: { uTime: this.uniforms.uTime, uNight: this.night, uPixelRatio: { value: this.renderer.getPixelRatio() }, uSize: { value: 7 }, uCamZ: { value: this.camera.position.z } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  /* ------------------------------------------------------------ state */
  setPointer(x, y) {
    this.pointer.set(x, y);
  }

  setProgress(p) {
    this.progress = p;
    if (this.reduced) this.loop.renderOnce();
  }

  setNight(isNight, animate = true) {
    gsap.to(this.night, {
      value: isNight ? 1 : 0,
      duration: animate && !this.reduced ? 1.6 : 0,
      ease: 'power2.inOut',
      onUpdate: () => this.applyNight(),
      onComplete: () => this.reduced && this.loop.renderOnce(),
    });
  }

  /** Push the day/night mix into lights, fog and light-dependent materials. */
  applyNight() {
    const k = this.night.value;
    this.uniforms.uSunDir.value.copy(SUN_DAY).lerp(SUN_NIGHT, k).normalize();
    this.sun.position.copy(this.uniforms.uSunDir.value).multiplyScalar(50);
    this.sun.intensity = THREE.MathUtils.lerp(1.6, 0.25, k);
    this.sun.color.set('#ffd08a').lerp(new THREE.Color('#9fb8ff'), k);
    this.hemi.intensity = THREE.MathUtils.lerp(1.1, 0.25, k);
    this.scene.fog.color.set(PALETTE.horizonDay).lerp(new THREE.Color(PALETTE.horizonNight), k);
    // diyas glow much brighter at night
    this.diyaFactory.glowMats.forEach((m) => (m.opacity = THREE.MathUtils.lerp(0.35, 0.95, k)));
    this.diyaFactory.flameMats.forEach((m) => (m.uniforms.uIntensity.value = THREE.MathUtils.lerp(0.75, 1, k)));
  }

  /* ------------------------------------------------------------ frame */
  frame(dt, t) {
    this.uniforms.uTime.value = t;
    const ease = this.reduced ? 1 : Math.min(1, dt * 3);
    this.pointerEased.lerp(this.pointer, ease);
    this.progressEased += (this.progress - this.progressEased) * (this.reduced ? 1 : Math.min(1, dt * 4));

    // Camera: travel downstream with scroll + mouse parallax
    const p = this.progressEased;
    const cam = this.camera;
    cam.position.set(
      this.base.x + this.pointerEased.x * 1.1 + Math.sin(p * Math.PI) * 2.2,
      this.base.y + this.pointerEased.y * 0.5 + Math.sin(p * Math.PI) * 0.8 - p * 0.3,
      this.base.z - p * 46,
    );
    cam.lookAt(this.pointerEased.x * 0.6 - Math.sin(p * Math.PI * 1.2) * 2, 0.9 + this.pointerEased.y * 0.25, cam.position.z - 18);

    // Water follows the camera, snapped to the grid so vertices don't "swim"
    this.water.position.z = Math.round((cam.position.z - 60) / this.cell) * this.cell;
    this.water.position.x = Math.round(cam.position.x / this.cell) * this.cell;

    // Floating items: drift downstream (+z), bob on the waves, wrap around the camera window
    const amp = this.uniforms.uAmp.value;
    const diyaUniform = this.water.material.uniforms.uDiyas.value;
    let di = 0;
    for (const o of this.floaters) {
      const u = o.userData;
      if (!this.reduced) o.position.z += u.drift * dt;
      if (o.position.z > cam.position.z + 6) o.position.z -= Z_SPAN;
      if (o.position.z < cam.position.z + 6 - Z_SPAN) o.position.z += Z_SPAN;
      const { x, z } = o.position;
      const h = waveHeight(x, z, t, amp);
      // approximate tilt from wave slope
      const hx = waveHeight(x + 0.3, z, t, amp) - h;
      const hz = waveHeight(x, z + 0.3, t, amp) - h;
      o.position.y = h - 0.02;
      o.rotation.z = -hx * 1.5;
      o.rotation.x = hz * 1.5;
      if (!this.reduced) o.rotation.y += dt * 0.05 * (u.phase > 5 ? 1 : -1);
      if (u.kind === 'diya' && di < 16) diyaUniform[di++].set(x, h, z);
    }

    this.diyaFactory.update(t);
    this.fireflies.material.uniforms.uCamZ.value = cam.position.z;
    if (this.flag) this.flag.rotation.y = Math.sin(t * 2) * 0.3;
    this.sky.position.copy(cam.position);

    this.renderer.render(this.scene, cam);
  }

  start() {
    if (this.reduced) this.loop.renderOnce();
  }

  dispose() {
    this.loop.dispose();
    this.diyaFactory.dispose();
    this.lotusFactory.dispose();
    disposeRenderer(this.renderer, this.scene);
  }
}
