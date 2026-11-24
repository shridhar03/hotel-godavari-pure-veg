/**
 * Preloader: a single diya on a dark river-teal background. The flame shader's
 * uIntensity follows load progress, so the lamp literally brightens as the site loads.
 */
import * as THREE from 'three';
import { createRenderer, RenderLoop, disposeRenderer, makeGlowTexture } from '../core/three-utils.js';
import { createDiyaFactory } from './props.js';

export class PreloaderScene {
  constructor(canvas) {
    this.renderer = createRenderer(canvas, { alpha: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.camera.position.set(0, 0.9, 3.2);
    this.camera.lookAt(0, 0.35, 0);
    this.progress = 0;
    this.shown = 0; // eased progress

    this.scene.add(new THREE.HemisphereLight('#ffd9a0', '#04212a', 0.4));
    this.light = new THREE.PointLight('#ffb347', 0.5, 6, 1.6);
    this.light.position.set(0.12, 0.7, 0.2);
    this.scene.add(this.light);

    this.diyas = createDiyaFactory();
    this.diya = this.diyas.create({ seed: 0.3, intensity: 0.05, glow: 0.4 });
    this.diya.scale.setScalar(1.25);
    this.scene.add(this.diya);

    // Large soft halo behind the lamp
    this.haloTex = makeGlowTexture(256, 'rgba(255,190,90,1)', 'rgba(244,163,0,0)');
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.halo.scale.setScalar(3.2);
    this.halo.position.set(0.15, 0.75, -0.4);
    this.scene.add(this.halo);

    this.loop = new RenderLoop({
      renderer: this.renderer,
      onResize: (w, h) => {
        this.camera.aspect = w / h;
        // keep the lamp a similar size on portrait phones
        this.camera.fov = w < h ? 48 : 32;
        this.camera.updateProjectionMatrix();
      },
      onFrame: (dt, t) => this.frame(dt, t),
    });
  }

  setProgress(p) {
    this.progress = p;
  }

  frame(dt, t) {
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 4);
    const k = this.shown;
    const { flame, glow } = this.diya.userData;
    flame.uniforms.uIntensity.value = 0.08 + k * 0.92;
    glow.opacity = 0.15 + k * 0.6;
    this.halo.material.opacity = 0.05 + k * 0.45;
    this.light.intensity = 0.3 + k * 2.2 + Math.sin(t * 11) * 0.08 * k;
    this.diyas.update(t);
    this.diya.rotation.y = Math.sin(t * 0.4) * 0.15;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.loop.dispose();
    this.diyas.dispose();
    this.haloTex.dispose();
    disposeRenderer(this.renderer, this.scene);
  }
}
