/**
 * WebGL gallery layer.
 *
 * The gallery is normal, accessible HTML (<button><img></button>). This class
 * lays a transparent canvas over it and draws one textured plane per image,
 * exactly where the DOM image sits (orthographic camera in CSS pixels). Once
 * every texture is ready the DOM images are hidden (.gl-ready) and the planes
 * take over, adding the ripple/RGB-split hover shader (shaders/ripple.*.glsl).
 *
 * If WebGL is unavailable the plain images simply stay visible.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { createRenderer, RenderLoop, disposeRenderer } from '../core/three-utils.js';
import { ripple } from '../shaders/index.js';

export class GalleryGL {
  constructor(canvas, wrap, items, { reduced = false } = {}) {
    this.wrap = wrap;
    this.items = items; // [{ el: HTMLElement (button), img: HTMLImageElement }]
    this.reduced = reduced;
    this.renderer = createRenderer(canvas, { alpha: true, antialias: true });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -1000, 1000);
    this.geo = new THREE.PlaneGeometry(1, 1, 24, 24);
    this.meshes = [];
    this.loader = new THREE.TextureLoader();

    this.loop = new RenderLoop({
      renderer: this.renderer,
      observe: wrap,
      onResize: (w, h) => {
        Object.assign(this.camera, { left: 0, right: w, top: 0, bottom: -h });
        this.camera.updateProjectionMatrix();
        this.layout();
      },
      onFrame: (dt, t) => this.frame(dt, t),
    });

    this.ready = Promise.all(items.map((it, i) => this.addItem(it, i))).then(() => {
      this.layout();
      wrap.classList.add('gl-ready');
      this.loop.renderOnce();
    });
  }

  addItem({ el, img }, i) {
    return new Promise((resolve) => {
      this.loader.load(
        img.currentSrc || img.src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          const mat = new THREE.ShaderMaterial({
            ...ripple,
            transparent: true,
            uniforms: {
              uTex: { value: tex },
              uTime: { value: 0 },
              uHover: { value: 0 },
              uMouse: { value: new THREE.Vector2(0.5, 0.5) },
              uCover: { value: new THREE.Vector2(1, 1) },
              uRadius: { value: 16 },
              uSize: { value: new THREE.Vector2(1, 1) },
              uAlpha: { value: 1 },
            },
          });
          const mesh = new THREE.Mesh(this.geo, mat);
          mesh.userData = { el, img, aspect: tex.image.width / tex.image.height };
          this.scene.add(mesh);
          this.meshes[i] = mesh;
          this.bindHover(el, mat);
          resolve();
        },
        undefined,
        () => resolve(), // keep the DOM image if a texture fails
      );
    });
  }

  bindHover(el, mat) {
    const u = mat.uniforms;
    const setMouse = (e) => {
      const r = el.getBoundingClientRect();
      u.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    };
    el.addEventListener('pointerenter', (e) => { setMouse(e); if (!this.reduced) gsap.to(u.uHover, { value: 1, duration: 0.8, ease: 'power3.out' }); });
    el.addEventListener('pointermove', setMouse, { passive: true });
    el.addEventListener('pointerleave', () => gsap.to(u.uHover, { value: 0, duration: 0.9, ease: 'power3.out' }));
    el.addEventListener('focus', () => { u.uMouse.value.set(0.5, 0.5); if (!this.reduced) gsap.to(u.uHover, { value: 0.6, duration: 0.6 }); });
    el.addEventListener('blur', () => gsap.to(u.uHover, { value: 0, duration: 0.6 }));
  }

  /** Match every plane to its DOM image rect (relative to the canvas). */
  layout() {
    const base = this.renderer.domElement.getBoundingClientRect();
    for (const m of this.meshes) {
      if (!m) continue;
      const r = m.userData.el.getBoundingClientRect();
      const x = r.left - base.left;
      const y = r.top - base.top;
      m.scale.set(r.width, r.height, 1);
      m.position.set(x + r.width / 2, -(y + r.height / 2), 0);
      const planeAspect = r.width / r.height;
      const imgAspect = m.userData.aspect;
      // object-fit: cover
      m.material.uniforms.uCover.value.set(Math.min(planeAspect / imgAspect, 1), Math.min(imgAspect / planeAspect, 1));
      m.material.uniforms.uSize.value.set(r.width, r.height);
    }
  }

  /** Temporarily hide one plane (used while the lightbox animates from it). */
  setAlpha(i, a) {
    const m = this.meshes[i];
    if (m) m.material.uniforms.uAlpha.value = a;
    this.loop.renderOnce();
  }

  frame(dt, t) {
    // Re-sync with the DOM every frame: cheap for 8 rects and keeps planes glued
    // to their images during reveal animations, font swaps and responsive reflow.
    this.layout();
    for (const m of this.meshes) if (m) m.material.uniforms.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.loop.dispose();
    this.geo.dispose();
    disposeRenderer(this.renderer, this.scene);
  }
}
