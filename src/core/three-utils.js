import * as THREE from 'three';

/**
 * Create a WebGLRenderer with sane production defaults.
 * - devicePixelRatio is capped (2 by default) to keep fill-rate in check on 3x phones / 4K screens
 * - sRGB output + ACES tone mapping for filmic colour
 */
export function createRenderer(canvas, { alpha = true, antialias = true, maxDpr = 2 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  return renderer;
}

/**
 * Drives a scene's render loop and pauses it when:
 *  - the canvas (or a given container) is scrolled off-screen (IntersectionObserver)
 *  - the tab is hidden (visibilitychange)
 * Also keeps the renderer sized to the canvas' CSS box via ResizeObserver.
 */
export class RenderLoop {
  constructor({ renderer, observe, onFrame, onResize, manual = false }) {
    this.renderer = renderer;
    // manual = reduced motion: never loop, only draw a still frame when needed
    this.manual = manual;
    this.onFrame = onFrame;
    this.onResize = onResize;
    this.visible = false;
    this.running = false;
    this._last = 0;
    this.elapsed = 0;
    this._raf = 0;
    this._tick = this._tick.bind(this);

    const el = observe || renderer.domElement;
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this._update();
    }, { rootMargin: '100px' });
    this.io.observe(el);

    this._onVis = () => this._update();
    document.addEventListener('visibilitychange', this._onVis);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(renderer.domElement);
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.onResize?.(w, h);
    if (this.manual && this.visible) this.renderOnce();
  }

  _update() {
    const shouldRun = this.visible && !document.hidden && !this.disposed;
    if (this.manual) {
      if (shouldRun) this.renderOnce();
      return;
    }
    if (shouldRun && !this.running) {
      this.running = true;
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._tick);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this._raf);
    }
  }

  _tick() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 1 / 20); // clamp big gaps (tab switches)
    this._last = now;
    this.elapsed += dt;
    this.onFrame(dt, this.elapsed);
    this._raf = requestAnimationFrame(this._tick);
  }

  /** Render a single frame (used for reduced motion: static image, no loop). */
  renderOnce() {
    this.onFrame(0, this.elapsed);
  }

  dispose() {
    this.disposed = true;
    this._update();
    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
  }
}

/**
 * Recursively dispose geometries, materials and textures under an Object3D.
 * Call on unmount to avoid GPU memory leaks.
 */
export function disposeObject(root) {
  if (!root) return;
  const textures = new Set();
  root.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v && v.isTexture && textures.add(v));
      if (m.uniforms) Object.values(m.uniforms).forEach((u) => u?.value?.isTexture && textures.add(u.value));
      m.dispose();
    });
  });
  textures.forEach((t) => t.dispose());
}

/** Fully tear down a renderer and its scene. */
export function disposeRenderer(renderer, scene) {
  disposeObject(scene);
  renderer.renderLists?.dispose();
  renderer.dispose();
  renderer.forceContextLoss?.();
}

/** A soft round sprite texture (for glows / particles), generated on a canvas so no image is needed. */
export function makeGlowTexture(size = 128, inner = 'rgba(255,220,140,1)', outer = 'rgba(244,163,0,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
