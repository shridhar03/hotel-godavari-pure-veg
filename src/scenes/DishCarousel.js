/**
 * Signature dishes: a lazy-susan style 3D carousel of plates.
 *
 * Each plate is a procedural low-poly placeholder (see buildFood) chosen by the
 * dish's "plate" field in public/data/signature.json. If a dish has a "model"
 * (.glb, DRACO OK) it is lazy-loaded and replaces the placeholder food.
 *
 * Interaction: hover → plate lifts, spins and glows; click → onSelect(dish);
 * drag / swipe → turn the table, snapping to the nearest plate on release.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { createRenderer, RenderLoop, disposeRenderer, makeGlowTexture } from '../core/three-utils.js';
import { loadGLB } from '../core/loaders.js';

const C = (hex) => new THREE.Color(hex);

export class DishCarousel {
  constructor(canvas, dishes, { onSelect, onChange, reduced = false } = {}) {
    this.dishes = dishes;
    this.onSelect = onSelect;
    this.onChange = onChange;
    this.reduced = reduced;
    this.index = 0;
    this.angle = { value: 0 };
    this.hovered = null;
    this.mats = new Map(); // cache standard materials by colour

    this.renderer = createRenderer(canvas, { alpha: true });
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight('#fff1d6', '#0e5e6f', 0.6));
    const key = new THREE.DirectionalLight('#ffd9a0', 2.2);
    key.position.set(3, 6, 5);
    const rim = new THREE.DirectionalLight('#5fa9b7', 1.2);
    rim.position.set(-4, 3, -4);
    this.scene.add(key, rim);

    this.ring = new THREE.Group();
    this.scene.add(this.ring);
    this.radius = 3.9;
    this.glowTex = makeGlowTexture(128, 'rgba(255,200,90,1)', 'rgba(244,163,0,0)');
    this.shadowTex = makeGlowTexture(128, 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)');
    this.plates = dishes.map((d, i) => this.buildPlate(d, i));

    // Brass lazy-susan the plates sit on
    const table = new THREE.Mesh(new THREE.CylinderGeometry(this.radius + 1.1, this.radius + 1.2, 0.12, 64), this.mat('#6b4a2a', { roughness: 0.55, metalness: 0.2 }));
    table.position.y = -0.1;
    this.ring.add(table);
    const inlay = new THREE.Mesh(new THREE.TorusGeometry(this.radius + 0.95, 0.03, 8, 96), this.mat('#d4a24c', { metalness: 1, roughness: 0.3 }));
    inlay.rotation.x = Math.PI / 2;
    inlay.position.y = -0.03;
    this.ring.add(inlay);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(9, 9);
    this.bindInput(canvas);

    this.loop = new RenderLoop({
      renderer: this.renderer,
      manual: false,
      onResize: (w, h) => {
        this.camera.aspect = w / h;
        const portrait = w / h < 1;
        this.camera.fov = portrait ? 50 : 30;
        this.camera.position.set(0, portrait ? 5.4 : 4.6, this.radius + (portrait ? 8.6 : 8.2));
        this.camera.lookAt(0, portrait ? -0.6 : -1.1, this.radius * 0.3);
        this.camera.updateProjectionMatrix();
      },
      onFrame: (dt, t) => this.frame(dt, t),
    });
    this.goTo(0, false);
    this.loadModels();
  }

  mat(color, opts = {}) {
    const k = color + JSON.stringify(opts);
    if (!this.mats.has(k)) this.mats.set(k, new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.6, metalness: 0, ...opts }));
    return this.mats.get(k);
  }

  /* ------------------------------------------------------------ plate builders */
  buildPlate(dish, i) {
    const holder = new THREE.Group(); // positioned on the ring
    const a = (i / this.dishes.length) * Math.PI * 2;
    holder.position.set(Math.sin(a) * this.radius, 0, Math.cos(a) * this.radius);
    holder.rotation.y = a;

    const plate = new THREE.Group(); // animated on hover
    holder.scale.setScalar(1.25);
    holder.add(plate);

    // soft contact shadow: a radial-gradient quad lying on the table
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }));
    shadowMesh.position.y = -0.03;
    holder.add(shadowMesh);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    glow.position.y = -0.02;
    holder.add(glow);

    const food = this.buildFood(dish);
    plate.add(food);
    plate.userData = { dish, index: i, glow, shadow: shadowMesh, food, hover: { value: 0 } };
    plate.traverse((o) => (o.userData.plateRoot = plate));
    this.ring.add(holder);
    return plate;
  }

  /** Brass thali base used by most dishes. */
  brassPlate(r = 1, rim = 0.08) {
    const profile = [[0, 0], [r * 0.85, 0], [r, rim], [r * 1.02, rim + 0.02], [r * 0.98, rim + 0.03], [r * 0.86, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.Mesh(new THREE.LatheGeometry(profile, 48), this.mat('#c99a4b', { metalness: 1, roughness: 0.28 }));
  }

  katori(r, fill, y = 0.05) {
    const g = new THREE.Group();
    const profile = [[0, 0], [r * 0.7, 0], [r, r * 0.55], [r * 1.02, r * 0.6], [r * 0.95, r * 0.6], [r * 0.66, 0.04], [0, 0.04]].map(([x, yy]) => new THREE.Vector2(x, yy));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), this.mat('#d1a554', { metalness: 1, roughness: 0.25 })));
    const surf = new THREE.Mesh(new THREE.CircleGeometry(r * 0.93, 24).rotateX(-Math.PI / 2), this.mat(fill, { roughness: 0.45 }));
    surf.position.y = r * 0.48;
    g.add(surf);
    g.position.y = y;
    return g;
  }

  buildFood(dish) {
    const g = new THREE.Group();
    const [c0, c1, c2 = '#3A7D44', c3 = '#FFF3D6'] = dish.colors || [];
    switch (dish.plate) {
      case 'thali': {
        g.add(this.brassPlate(1.15));
        const fills = dish.colors.slice(0, 5);
        fills.forEach((c, k) => {
          const a = (k / fills.length) * Math.PI * 1.4 - 0.2;
          const b = this.katori(0.24, c);
          b.position.set(Math.cos(a) * 0.78, 0.04, Math.sin(a) * -0.78);
          g.add(b);
        });
        const rice = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('#fffaf0', { roughness: 0.9 }));
        rice.scale.y = 0.6;
        rice.position.set(0.05, 0.04, 0.25);
        g.add(rice);
        for (let k = 0; k < 2; k++) {
          const roti = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 28), this.mat('#e3b56a', { roughness: 0.85 }));
          roti.position.set(-0.45 + k * 0.06, 0.07 + k * 0.03, 0.42);
          roti.rotation.z = 0.12;
          g.add(roti);
        }
        break;
      }
      case 'bowl': {
        g.add(this.brassPlate(1.05));
        const bowl = this.katori(0.6, c0, 0.04);
        g.add(bowl);
        // farsan crunch on top: instanced tiny boxes
        const n = 80;
        const farsan = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.02, 0.07), this.mat(c2 || '#E9C46A', { roughness: 0.8 }), n);
        const m = new THREE.Matrix4();
        const e = new THREE.Euler();
        for (let k = 0; k < n; k++) {
          const rr = Math.sqrt(Math.random()) * 0.45;
          const a = Math.random() * Math.PI * 2;
          m.makeRotationFromEuler(e.set(Math.random() * 3, Math.random() * 3, 0));
          m.setPosition(Math.cos(a) * rr, 0.38, Math.sin(a) * rr);
          farsan.setMatrixAt(k, m);
        }
        g.add(farsan);
        for (let k = 0; k < 2; k++) {
          const pav = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.32, 2, 2, 2), this.mat('#d9964a', { roughness: 0.8 }));
          pav.position.set(0.7 + k * 0.05, 0.14, 0.45 - k * 0.36);
          pav.rotation.y = 0.3;
          g.add(pav);
        }
        const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI), this.mat('#f2d84b'));
        lemon.position.set(-0.7, 0.1, 0.45);
        g.add(lemon);
        break;
      }
      case 'flat': {
        g.add(this.brassPlate(1.05));
        for (let k = 0; k < 3; k++) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.05, 36), this.mat(k === 2 ? c1 : c0, { roughness: 0.7 }));
          p.position.set(k * 0.05, 0.08 + k * 0.05, -k * 0.04);
          g.add(p);
        }
        const ghee = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('#fff2b8', { roughness: 0.2 }));
        ghee.position.set(0.1, 0.23, 0);
        g.add(ghee);
        const amti = this.katori(0.22, '#8a4a1c');
        amti.position.set(-0.7, 0.04, 0.4);
        g.add(amti);
        break;
      }
      case 'skewer': {
        g.add(this.brassPlate(1.05));
        for (let s = 0; s < 2; s++) {
          const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 6), this.mat('#8a6a48'));
          stick.rotation.z = Math.PI / 2;
          stick.position.set(0, 0.2, -0.2 + s * 0.4);
          g.add(stick);
          for (let k = 0; k < 6; k++) {
            const isPaneer = k % 2 === 0;
            const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.mat(isPaneer ? c0 : k % 3 ? c2 : c3 || '#C0392B', { roughness: 0.7 }));
            cube.position.set(-0.6 + k * 0.24, 0.2, -0.2 + s * 0.4);
            cube.rotation.set(Math.random() * 0.3, Math.random() * 0.4, 0);
            g.add(cube);
            if (isPaneer) {
              const char = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.04, 0.205), this.mat(c1, { roughness: 0.9 }));
              char.position.copy(cube.position).add(new THREE.Vector3(0, 0.085, 0));
              g.add(char);
            }
          }
        }
        const chutney = this.katori(0.18, '#3A7D44');
        chutney.position.set(0.7, 0.04, 0.6);
        g.add(chutney);
        break;
      }
      case 'dosa': {
        const tray = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.1), this.mat('#c99a4b', { metalness: 1, roughness: 0.3 }));
        tray.position.y = 0.03;
        g.add(tray);
        const dosa = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 24, 1, true, 0, Math.PI * 1.6), this.mat(c0, { roughness: 0.6, side: THREE.DoubleSide }));
        dosa.rotation.z = Math.PI / 2;
        dosa.position.set(0, 0.24, -0.1);
        g.add(dosa);
        const s1 = this.katori(0.17, '#C4441C');
        s1.position.set(-0.6, 0.06, 0.35);
        const s2 = this.katori(0.17, '#FFF8EC');
        s2.position.set(0, 0.06, 0.38);
        const s3 = this.katori(0.17, '#E07A2F');
        s3.position.set(0.6, 0.06, 0.35);
        g.add(s1, s2, s3);
        break;
      }
      case 'sweets':
      default: {
        g.add(this.brassPlate(1.05));
        // modak: lathe teardrop with pleats
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const t = k / 12;
          pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.17 * (1 - t * 0.55) + 0.001, t * 0.38));
        }
        const modakGeo = new THREE.LatheGeometry(pts, 16);
        const pos = modakGeo.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const x = pos.getX(k);
          const z = pos.getZ(k);
          const a = Math.atan2(z, x);
          const f = 1 + Math.sin(a * 8) * 0.08;
          pos.setX(k, x * f);
          pos.setZ(k, z * f);
        }
        modakGeo.computeVertexNormals();
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(modakGeo, this.mat(c0, { roughness: 0.5 }));
          m.position.set(-0.45 + k * 0.3, 0.05, -0.35);
          g.add(m);
        }
        for (let k = 0; k < 3; k++) {
          const j = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), this.mat(c1, { roughness: 0.25 }));
          j.position.set(-0.4 + k * 0.3, 0.17, 0.25);
          g.add(j);
        }
        const jalebi = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.035, 64, 6, 2, 5), this.mat(c2 || '#F4A300', { roughness: 0.3 }));
        jalebi.rotation.x = Math.PI / 2;
        jalebi.position.set(0.55, 0.12, 0.1);
        g.add(jalebi);
        break;
      }
    }
    return g;
  }

  /** Swap placeholders for real GLB models where configured. */
  async loadModels() {
    for (const plate of this.plates) {
      const { dish } = plate.userData;
      if (!dish.model) continue;
      try {
        const model = await loadGLB(dish.model, this.renderer);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        model.scale.setScalar(2.4 / size);
        plate.remove(plate.userData.food);
        plate.add(model);
        plate.userData.food = model;
        model.traverse((o) => (o.userData.plateRoot = plate));
      } catch (e) {
        console.warn('[DishCarousel] could not load', dish.model, e);
      }
    }
  }

  /* ------------------------------------------------------------ input */
  bindInput(canvas) {
    let dragging = false;
    let startX = 0;
    let startAngle = 0;
    let moved = 0;
    const step = (Math.PI * 2) / this.dishes.length;

    const setMouse = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return r;
    };
    this._down = (e) => {
      setMouse(e);
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startAngle = this.angle.value;
      gsap.killTweensOf(this.angle);
    };
    this._move = (e) => {
      if (!dragging && e.target !== canvas) return;
      const r = setMouse(e);
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      this.angle.value = startAngle + (dx / r.width) * Math.PI * 1.2;
    };
    this._up = () => {
      if (!dragging) return;
      dragging = false;
      if (moved > 6) {
        const i = Math.round(-this.angle.value / step);
        this.goTo(((i % this.dishes.length) + this.dishes.length) % this.dishes.length, true, i);
      }
    };
    this._leave = () => this.mouse.set(9, 9);
    this._click = (e) => {
      if (moved > 6) return;
      // raycast at the click point (touch devices have no hover state)
      setMouse(e);
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hit = this.raycaster.intersectObjects(this.plates, true)[0];
      const plate = hit?.object.userData.plateRoot;
      if (plate) {
        const idx = plate.userData.index;
        if (idx !== this.index) this.goTo(idx);
        this.onSelect?.(this.dishes[idx], idx);
      }
    };
    canvas.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointerleave', this._leave);
    canvas.addEventListener('click', this._click);
    this.canvas = canvas;
  }

  /**
   * Rotate so dish i faces the camera. `turns` lets drag-release keep the
   * unwrapped angle so the table never spins the long way round.
   */
  goTo(i, animate = true, turns) {
    const n = this.dishes.length;
    const step = (Math.PI * 2) / n;
    let target;
    if (turns !== undefined) target = -turns * step;
    else {
      // shortest path from current angle
      const cur = -this.angle.value / step;
      let d = i - (((Math.round(cur) % n) + n) % n);
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      target = -(Math.round(cur) + d) * step;
    }
    this.index = i;
    gsap.to(this.angle, { value: target, duration: animate && !this.reduced ? 1.1 : 0, ease: 'power3.out' });
    this.onChange?.(this.dishes[i], i);
  }
  next() { this.goTo((this.index + 1) % this.dishes.length); }
  prev() { this.goTo((this.index - 1 + this.dishes.length) % this.dishes.length); }

  /* ------------------------------------------------------------ frame */
  frame(dt, t) {
    this.ring.rotation.y = this.angle.value;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.plates, true)[0];
    const plate = hit?.object.userData.plateRoot || null;
    if (plate !== this.hovered) {
      if (this.hovered) gsap.to(this.hovered.userData.hover, { value: 0, duration: 0.6, ease: 'power3.out' });
      if (plate) gsap.to(plate.userData.hover, { value: 1, duration: 0.6, ease: 'power3.out' });
      this.hovered = plate;
      this.canvas.style.cursor = plate ? 'pointer' : '';
      document.getElementById('cursor')?.classList.toggle('is-hover', !!plate);
    }

    for (const p of this.plates) {
      const { hover, glow, shadow, index } = p.userData;
      const front = index === this.index ? 1 : 0;
      const h = hover.value;
      p.position.y = h * 0.45 + Math.sin(t * 1.4 + index) * 0.03;
      p.rotation.y += dt * (0.15 + h * 1.4);
      glow.material.opacity = h * 0.9 + front * 0.25;
      shadow.material.opacity = 0.55 - h * 0.25;
      shadow.scale.setScalar(1 + h * 0.2);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.loop.dispose();
    this.canvas.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    this.canvas.removeEventListener('pointerleave', this._leave);
    this.canvas.removeEventListener('click', this._click);
    this.mats.forEach((m) => m.dispose());
    [this.glowTex, this.shadowTex, this.envTex].forEach((t) => t.dispose());
    disposeRenderer(this.renderer, this.scene);
  }
}
