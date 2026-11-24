/**
 * Rooms: an orbitable, auto-rotating diorama of the selected room type.
 *
 * Rooms are generated from simple boxes using each room's "layout" and
 * "palette" in public/data/rooms.json. Set "model" to a .glb to load a real
 * (DRACO-compressed) room model instead.
 *
 * Walls between the camera and the room fade out automatically, so the
 * auto-rotate can go all the way round like a dollhouse.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { createRenderer, RenderLoop, disposeRenderer, disposeObject } from '../core/three-utils.js';
import { loadGLB } from '../core/loaders.js';

const W = 6; // room width (x)
const D = 5; // room depth (z)
const H = 2.8;

export class RoomPreview {
  constructor(canvas, { reduced = false } = {}) {
    this.reduced = reduced;
    this.renderer = createRenderer(canvas, { alpha: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(8.5, 7, 9.5);

    // Soft, warm lighting: sky fill + a "window" sun that casts soft shadows + a bedside lamp
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#8b5e3c', 0.9));
    const sun = new THREE.DirectionalLight('#ffe0b0', 2.2);
    sun.position.set(-4, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    this.scene.add(sun);

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      enablePan: false,
      minDistance: 6,
      maxDistance: 18,
      minPolarAngle: 0.35,
      maxPolarAngle: 1.25,
      autoRotate: !reduced,
      autoRotateSpeed: 0.8,
    });
    this.controls.target.set(0, 0.8, 0);
    // pause auto-rotate while the user is interacting, resume a moment later
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; clearTimeout(this._resume); });
    this.controls.addEventListener('end', () => { this._resume = setTimeout(() => (this.controls.autoRotate = !reduced), 2500); });
    this.controls.addEventListener('change', () => reduced && this.loop?.renderOnce());

    this.room = null;
    this.loop = new RenderLoop({
      renderer: this.renderer,
      manual: false, // orbit controls need a loop even with reduced motion (auto-rotate is off then)
      onResize: (w, h) => {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      },
      onFrame: (dt) => this.frame(dt),
    });
  }

  m(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts });
  }

  box(w, h, d, mat, x, y, z) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y + h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    return b;
  }

  bed(group, { w, x, z, pal, pillows = 2 }) {
    const wood = this.m(pal.floor, { roughness: 0.6 });
    const linen = this.m('#FFF8EC', { roughness: 0.95 });
    const throwMat = this.m(pal.bed, { roughness: 0.9 });
    group.add(this.box(w, 0.35, 2.1, wood, x, 0, z));
    group.add(this.box(w - 0.1, 0.25, 2, linen, x, 0.35, z + 0.02));
    group.add(this.box(w - 0.05, 0.06, 0.8, throwMat, x, 0.6, z + 0.55));
    group.add(this.box(w + 0.1, 1.1, 0.12, wood, x, 0, z - 1.08)); // headboard
    for (let i = 0; i < pillows; i++) {
      const p = this.box(0.6, 0.16, 0.38, linen, x - (w / 2) + 0.45 + i * ((w - 0.9) / Math.max(1, pillows - 1)), 0.6, z - 0.7);
      group.add(p);
    }
  }

  lamp(group, x, z, accent) {
    group.add(this.box(0.5, 0.5, 0.45, this.m('#6b4a2a'), x, 0, z));
    group.add(this.box(0.05, 0.35, 0.05, this.m('#c99a4b', { metalness: 1, roughness: 0.3 }), x, 0.5, z));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.25, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: accent, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.set(x, 0.95, z);
    group.add(shade);
    const light = new THREE.PointLight('#ffc070', 2.5, 4, 1.5);
    light.position.set(x, 0.95, z);
    group.add(light);
  }

  build(room) {
    const pal = room.palette;
    const g = new THREE.Group();
    const wallMat = () => this.m(pal.wall, { roughness: 0.95, transparent: true });
    const floor = this.box(W, 0.12, D, this.m(pal.floor, { roughness: 0.55 }), 0, -0.12, 0);
    g.add(floor);
    // rug
    g.add(this.box(2.6, 0.02, 1.8, this.m(pal.accent, { roughness: 1 }), 0.3, 0, 0.9));

    // four walls, each remembers its outward normal so it can fade when facing the camera
    this.walls = [];
    const wall = (w, x, z, ry, nx, nz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, 0.12), wallMat());
      m.position.set(x, H / 2, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      m.userData.normal = new THREE.Vector3(nx, 0, nz);
      g.add(m);
      this.walls.push(m);
      return m;
    };
    wall(W, 0, -D / 2, 0, 0, -1);
    wall(W, 0, D / 2, 0, 0, 1);
    wall(D, -W / 2, 0, Math.PI / 2, -1, 0);
    const right = wall(D, W / 2, 0, Math.PI / 2, 1, 0);

    // window (glowing river view) on the right wall
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ color: '#9fd3dd' }));
    win.position.set(0, 0.25, -0.07); // local -z is the room-facing side of this wall
    win.rotation.y = Math.PI;
    right.add(win);
    this.windowPane = win;

    // brass wall art (a sun-like mandala) on the back wall
    const art = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 32), this.m('#c99a4b', { metalness: 1, roughness: 0.3 }));
    art.position.set(0, 1.9, -D / 2 + 0.1);
    g.add(art);

    const wood = this.m(pal.floor, { roughness: 0.6 });
    switch (room.layout) {
      case 'executive':
        this.bed(g, { w: 2.2, x: -0.6, z: -1.2, pal, pillows: 3 });
        this.lamp(g, -2.2, -2, pal.accent);
        this.lamp(g, 1, -2, pal.accent);
        // lounge chair + desk
        g.add(this.box(0.9, 0.45, 0.9, this.m(pal.bed), 2, 0, 1.4));
        g.add(this.box(0.9, 0.6, 0.15, this.m(pal.bed), 2, 0.45, 1.85));
        g.add(this.box(1.6, 0.06, 0.7, wood, -2.1, 0.75, 1.5));
        g.add(this.box(0.06, 0.75, 0.6, wood, -2.85, 0, 1.5));
        g.add(this.box(0.06, 0.75, 0.6, wood, -1.35, 0, 1.5));
        break;
      case 'family':
        this.bed(g, { w: 2.2, x: -1.4, z: -1.2, pal, pillows: 3 });
        this.bed(g, { w: 1.0, x: 1.2, z: -1.2, pal, pillows: 1 });
        this.bed(g, { w: 1.0, x: 2.4, z: -1.2, pal, pillows: 1 });
        this.lamp(g, 0.25, -2.1, pal.accent);
        // sofa
        g.add(this.box(2.2, 0.4, 0.8, this.m(pal.accent), -1, 0, 1.8));
        g.add(this.box(2.2, 0.5, 0.2, this.m(pal.accent), -1, 0.4, 2.15));
        g.add(this.box(0.8, 0.35, 0.8, wood, 1, 0, 1.5));
        break;
      case 'deluxe':
      default:
        this.bed(g, { w: 1.8, x: -0.4, z: -1.2, pal });
        this.lamp(g, -1.8, -2, pal.accent);
        this.lamp(g, 1.0, -2, pal.accent);
        g.add(this.box(1.3, 0.06, 0.6, wood, 2.2, 0.75, 1.2));
        g.add(this.box(0.06, 0.75, 0.5, wood, 1.6, 0, 1.2));
        g.add(this.box(0.06, 0.75, 0.5, wood, 2.8, 0, 1.2));
        g.add(this.box(0.5, 0.45, 0.5, this.m(pal.bed), 2.2, 0, 1.9));
        break;
    }
    // a potted tulsi plant, because every Indian home has one
    const pot = this.box(0.35, 0.4, 0.35, this.m('#b0602a'), -2.6, 0, 2.1);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), this.m('#3A7D44', { flatShading: true }));
    leaves.position.set(-2.6, 0.7, 2.1);
    leaves.castShadow = true;
    g.add(pot, leaves);
    return g;
  }

  /** Show a room type with a scale/fade transition. */
  async setRoom(room) {
    if (this.current === room.id) return;
    this.current = room.id;
    let next;
    if (room.model) {
      try { next = await loadGLB(room.model, this.renderer); } catch (e) { console.warn('[RoomPreview] model failed, using placeholder', e); }
    }
    if (!next) next = this.build(room);
    if (this.current !== room.id) { disposeObject(next); return; } // user clicked another room meanwhile

    const old = this.room;
    this.room = next;
    this.scene.add(next);
    const dur = this.reduced ? 0 : 0.7;
    next.scale.setScalar(0.85);
    next.position.y = -0.5;
    gsap.to(next.scale, { x: 1, y: 1, z: 1, duration: dur, ease: 'power3.out' });
    gsap.to(next.position, { y: 0, duration: dur, ease: 'power3.out' });
    if (old) {
      gsap.to(old.scale, { x: 0.001, y: 0.001, z: 0.001, duration: dur * 0.6, ease: 'power2.in', onComplete: () => { this.scene.remove(old); disposeObject(old); } });
    }
    this.loop.renderOnce();
  }

  frame() {
    this.controls.update();
    // fade walls whose outward normal points at the camera
    if (this.walls) {
      const camDir = this.camera.position.clone().setY(0).normalize();
      for (const w of this.walls) {
        const facing = w.userData.normal.dot(camDir);
        const target = facing > 0.25 ? 0.0 : 1;
        w.material.opacity += (target - w.material.opacity) * 0.15;
        w.visible = w.material.opacity > 0.02;
        w.castShadow = w.material.opacity > 0.5;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    clearTimeout(this._resume);
    this.loop.dispose();
    this.controls.dispose();
    this.envTex.dispose();
    disposeRenderer(this.renderer, this.scene);
  }
}
