/**
 * Hero + About: the shared river canvas, the staggered heading reveal,
 * scroll-driven camera travel through the About panels, and number counters.
 */
import { gsap, ScrollTrigger } from '../core/scroll.js';
import { use3D, prefersReducedMotion, quality, isTouch } from '../core/env.js';
import { on } from '../core/bus.js';
import { splitChars } from './reveals.js';

let river = null;

/** Create the river scene (called during preloading so it counts toward progress). */
export async function createRiver() {
  if (!use3D) {
    document.documentElement.classList.add('no-webgl');
    return null;
  }
  try {
    const { RiverScene } = await import('../scenes/RiverScene.js');
    river = new RiverScene(document.getElementById('river-canvas'), {
      observe: document.getElementById('river-stage'),
      quality,
      night: document.documentElement.classList.contains('dark'),
      reduced: prefersReducedMotion,
    });
    river.start();
    on('theme', (dark) => river?.setNight(dark));
    return river;
  } catch (e) {
    console.warn('[hero] WebGL scene failed, showing fallback image', e);
    document.documentElement.classList.add('no-webgl');
    return null;
  }
}

/** Mouse / device-tilt parallax for the hero camera. */
function bindParallax() {
  if (!river || prefersReducedMotion) return;
  if (!isTouch) {
    addEventListener('pointermove', (e) => river.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });
  } else if ('DeviceOrientationEvent' in window) {
    // gentle tilt parallax on phones (only fires where permission isn't required)
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      river.setPointer(gsap.utils.clamp(-1, 1, e.gamma / 30), gsap.utils.clamp(-1, 1, (e.beta - 45) / 30));
    }, { passive: true });
  }
}

/** Intro timeline after the preloader: staggered char reveal + fade-ups. */
export function playHeroIntro() {
  bindParallax();
  const chars = [...document.querySelectorAll('.hero .split')].flatMap((el) => splitChars(el));
  if (prefersReducedMotion) return;
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from('.hero .eyebrow', { y: 20, autoAlpha: 0, duration: 1 })
    .from(chars, { yPercent: 110, rotate: 6, autoAlpha: 0, duration: 1.3, stagger: 0.028 }, '<0.1')
    .from('.hero__lead', { y: 24, autoAlpha: 0, duration: 1 }, '-=0.9')
    .from('.hero__ctas > *', { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, '-=0.8')
    .from('.scroll-cue', { autoAlpha: 0, duration: 1 }, '-=0.4');
}

/** About section: panels fade in and the river camera travels downstream. */
export function initAbout() {
  ScrollTrigger.create({
    trigger: '#about',
    start: 'top bottom',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => river?.setProgress(self.progress),
  });

  // Hero content drifts up and fades as the about panels arrive
  if (!prefersReducedMotion) {
    gsap.to('.hero__content', {
      yPercent: -30,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: '#about', start: 'top bottom', end: 'top 30%', scrub: true },
    });
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      gsap.from(panel, {
        y: 80,
        autoAlpha: 0,
        filter: 'blur(8px)',
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: panel, start: 'top 85%', toggleActions: 'play none none reverse' },
      });
    });
  }

  // Counters: 25+ Years, 150+ Dishes, 50K+ Guests
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    if (prefersReducedMotion) { el.textContent = end; return; }
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(obj, { v: end, duration: 2, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(obj.v)) }),
    });
  });
}
