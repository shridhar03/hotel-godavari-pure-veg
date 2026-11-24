/**
 * Smooth scrolling (Lenis) wired into GSAP's ticker and ScrollTrigger.
 * With prefers-reduced-motion, Lenis is skipped and native scrolling is used.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './env.js';

gsap.registerPlugin(ScrollTrigger);

let lenis = null;

export function initScroll() {
  if (prefersReducedMotion) return null;
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/** Offset for fixed header + optional special banner. */
const headerOffset = () => -(document.getElementById('navbar')?.offsetHeight || 0) + 8;

export function scrollToTarget(target, { immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const offset = el.id === 'top' ? 0 : headerOffset();
  if (lenis) lenis.scrollTo(el, { offset, immediate, duration: 1.2 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: immediate || prefersReducedMotion ? 'auto' : 'smooth' });
}

export const stopScroll = () => { lenis?.stop(); document.documentElement.style.overflow = 'hidden'; };
export const startScroll = () => { lenis?.start(); document.documentElement.style.overflow = ''; };
export { gsap, ScrollTrigger };
