/**
 * Procedural props shared by several scenes: the diya (clay oil lamp) and the lotus.
 * Built from primitives so no model files are needed. Geometries and materials are
 * created once per factory and shared by every instance (cheap to clone, one dispose).
 *
 * To use real models instead, load a GLB with core/loaders.js → loadGLB() and swap it in.
 */
import * as THREE from 'three';
import { flame as flameShader } from '../shaders/index.js';
import { makeGlowTexture } from '../core/three-utils.js';

/* ---------------------------------------------------------------- Diya */
export function createDiyaFactory() {
  // Lathe profile (x = radius, y = height) of a shallow clay bowl with a rolled rim.
  const profile = [
    [0.0, 0.0], [0.16, 0.0], [0.26, 0.03], [0.33, 0.09], [0.36, 0.16], [0.35, 0.2],
    [0.32, 0.19], [0.29, 0.13], [0.2, 0.08], [0.0, 0.08],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bowlGeo = new THREE.LatheGeometry(profile, 28);
  const oilGeo = new THREE.CircleGeometry(0.29, 24).rotateX(-Math.PI / 2).translate(0, 0.14, 0);
  const wickGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.08, 6).translate(0.12, 0.17, 0);
  // Flame quad: origin at the wick so the billboard grows upward.
  const flameGeo = new THREE.PlaneGeometry(0.34, 0.62).translate(0, 0.31, 0);

  const clay = new THREE.MeshStandardMaterial({ color: '#B0602A', roughness: 0.85, metalness: 0.0, emissive: '#5a1d00', emissiveIntensity: 0.25 });
  const oil = new THREE.MeshStandardMaterial({ color: '#E8A93A', roughness: 0.2, metalness: 0.3, emissive: '#F4A300', emissiveIntensity: 0.35 });
  const wick = new THREE.MeshBasicMaterial({ color: '#2a1a10' });
  const glowTex = makeGlowTexture(128, 'rgba(255,200,110,1)', 'rgba(244,120,0,0)');

  const flameMats = [];
  const glowMats = [];

  function create({ seed = Math.random(), intensity = 1, glow = 1 } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bowlGeo, clay));
    g.add(new THREE.Mesh(oilGeo, oil));
    g.add(new THREE.Mesh(wickGeo, wick));

    const fm = new THREE.ShaderMaterial({
      ...flameShader,
      uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: intensity } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    flameMats.push(fm);
    const f = new THREE.Mesh(flameGeo, fm);
    f.position.set(0.12, 0.2, 0);
    f.renderOrder = 2;
    g.add(f);

    const gm = new THREE.SpriteMaterial({ map: glowTex, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 * glow });
    glowMats.push(gm);
    const s = new THREE.Sprite(gm);
    s.scale.setScalar(1.6);
    s.position.set(0.12, 0.38, 0);
    s.renderOrder = 3;
    g.add(s);

    g.userData = { flame: fm, glow: gm, seed };
    return g;
  }

  function update(time) {
    for (const m of flameMats) m.uniforms.uTime.value = time;
  }

  function dispose() {
    [bowlGeo, oilGeo, wickGeo, flameGeo, clay, oil, wick, glowTex, ...flameMats, ...glowMats].forEach((d) => d.dispose());
  }

  return { create, update, dispose, glowMats, flameMats };
}

/* ---------------------------------------------------------------- Lotus */
export function createLotusFactory() {
  // A petal is a squashed, stretched hemisphere; tilted petals in two rings make the flower.
  const petalGeo = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  petalGeo.scale(0.22, 0.12, 0.5).translate(0, 0, 0.25);
  const centerGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.06, 12);
  const padGeo = new THREE.CircleGeometry(0.75, 28, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2);

  const petalOuter = new THREE.MeshStandardMaterial({ color: '#F6A5C0', roughness: 0.55, emissive: '#7a2348', emissiveIntensity: 0.18, side: THREE.DoubleSide });
  const petalInner = new THREE.MeshStandardMaterial({ color: '#FFD6E2', roughness: 0.5, emissive: '#7a2348', emissiveIntensity: 0.12, side: THREE.DoubleSide });
  const center = new THREE.MeshStandardMaterial({ color: '#F4C430', roughness: 0.6, emissive: '#8a5a00', emissiveIntensity: 0.3 });
  const pad = new THREE.MeshStandardMaterial({ color: '#3A7D44', roughness: 0.7, side: THREE.DoubleSide });

  function ring(group, count, tilt, mat, scale, offset = 0) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(petalGeo, mat);
      const a = (i / count) * Math.PI * 2 + offset;
      p.rotation.order = 'YXZ';
      p.rotation.y = a;
      p.rotation.x = -tilt;
      p.scale.setScalar(scale);
      group.add(p);
    }
  }

  function create({ withPad = true } = {}) {
    const g = new THREE.Group();
    const flower = new THREE.Group();
    ring(flower, 8, 0.35, petalOuter, 1);
    ring(flower, 6, 0.85, petalInner, 0.8, 0.3);
    const c = new THREE.Mesh(centerGeo, center);
    c.position.y = 0.05;
    flower.add(c);
    flower.position.y = 0.04;
    flower.scale.setScalar(0.9);
    g.add(flower);
    if (withPad) {
      const p = new THREE.Mesh(padGeo, pad);
      p.position.set(0.25, 0.0, 0.1);
      p.rotation.y = Math.random() * Math.PI * 2;
      g.add(p);
    }
    return g;
  }

  function dispose() {
    [petalGeo, centerGeo, padGeo, petalOuter, petalInner, center, pad].forEach((d) => d.dispose());
  }

  return { create, dispose };
}
