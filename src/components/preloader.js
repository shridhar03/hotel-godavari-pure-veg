/**
 * Preloader controller: shows % progress, drives the diya scene, then
 * transitions into the hero with a circular iris reveal.
 */
import { gsap } from '../core/scroll.js';
import { use3D, prefersReducedMotion } from '../core/env.js';

export function createPreloader() {
  const root = document.getElementById('preloader');
  const pctEl = document.getElementById('preloader-pct');
  const bar = document.getElementById('preloader-bar');
  let scene = null;
  const state = { shown: 0 };
  let target = 0;

  if (use3D) {
    import('../scenes/PreloaderScene.js')
      .then(({ PreloaderScene }) => {
        if (!root.isConnected) return;
        scene = new PreloaderScene(document.getElementById('preloader-canvas'));
        scene.setProgress(state.shown / 100);
      })
      .catch(() => {});
  }

  const render = () => {
    const v = Math.round(state.shown);
    pctEl.textContent = v;
    bar.style.width = v + '%';
    scene?.setProgress(v / 100);
  };

  return {
    /** p in 0..1 */
    setProgress(p) {
      target = Math.max(target, Math.min(1, p) * 100);
      gsap.to(state, { shown: target, duration: 0.6, ease: 'power2.out', onUpdate: render, overwrite: true });
    },
    /** Animate out; resolves when the hero should start its intro. */
    finish() {
      const quick = prefersReducedMotion;
      return new Promise((resolve) => {
        root.classList.add('is-done');
        gsap
          .timeline({
            onComplete: () => {
              root.hidden = true;
              scene?.dispose();
              scene = null;
            },
          })
          .to(state, { shown: 100, duration: 0.4, onUpdate: render, overwrite: true })
          .to('.preloader__ui', { autoAlpha: 0, y: -20, duration: quick ? 0.01 : 0.5, ease: 'power2.in' }, '+=0.25')
          .add(resolve)
          .fromTo(root, { clipPath: 'circle(150% at 50% 58%)' }, { clipPath: 'circle(0% at 50% 58%)', duration: quick ? 0.01 : 1.2, ease: 'expo.inOut' }, '<+0.1');
      });
    },
  };
}
