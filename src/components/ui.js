/**
 * Global UI chrome: navbar, mobile menu, custom cursor, magnetic buttons,
 * scroll progress bar, saffron section-wipe transitions and the theme toggle.
 */
import { gsap, ScrollTrigger, scrollToTarget, stopScroll, startScroll } from '../core/scroll.js';
import { prefersReducedMotion, isTouch } from '../core/env.js';
import { emit } from '../core/bus.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------ Navbar */
export function initNavbar() {
  const nav = $('#navbar');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  // Highlight the nav link for the section in view
  const links = $$('.nav-links a');
  links.forEach((a) => {
    const sec = document.querySelector(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => self.isActive && links.forEach((l) => l.setAttribute('aria-current', String(l === a))),
    });
  });

  // Solid navbar over light sections (the hero/about are dark, so the glass starts transparent)
  ScrollTrigger.create({
    trigger: '#river-stage',
    start: 'bottom top+=80',
    onEnter: () => nav.classList.add('is-solid'),
    onLeaveBack: () => nav.classList.remove('is-solid'),
  });

  // Mobile menu
  const btn = $('#hamburger');
  const menu = $('#mobile-menu');
  $$('li', menu).forEach((li, i) => li.style.setProperty('--i', i));
  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menu.toggleAttribute('inert', !open);
    nav.classList.toggle('menu-open', open);
    if (open) stopScroll();
    else startScroll();
    if (open) setTimeout(() => $('a', menu)?.focus(), 300);
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => e.target.closest('a') && setOpen(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      setOpen(false);
      btn.focus();
    }
  });
  matchMedia('(min-width: 1280px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

/* ------------------------------------------------------------ Scroll progress */
export function initScrollProgress() {
  const bar = $('#scroll-progress');
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });
}

/* ------------------------------------------------------------ Custom cursor */
export function initCursor() {
  if (isTouch || prefersReducedMotion) return;
  document.documentElement.classList.add('has-cursor');
  const cur = $('#cursor');
  const dot = $('.cursor__dot', cur);
  const ring = $('.cursor__ring', cur);
  const xDot = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const yDot = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const xRing = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const yRing = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('pointermove', (e) => { cur.classList.add('is-active'); xDot(e.clientX); yDot(e.clientY); xRing(e.clientX); yRing(e.clientY); }, { passive: true });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  const interactive = 'a, button, [role="button"], [role="tab"], input[type="checkbox"], label.toggle, .gallery-item';
  document.addEventListener('pointerover', (e) => e.target.closest?.(interactive) && cur.classList.add('is-hover'));
  document.addEventListener('pointerout', (e) => e.target.closest?.(interactive) && cur.classList.remove('is-hover'));
  document.documentElement.addEventListener('mouseleave', () => cur.classList.remove('is-active'));
}

/* ------------------------------------------------------------ Magnetic buttons */
export function initMagnetic(root = document) {
  if (isTouch || prefersReducedMotion) return;
  $$('[data-magnetic]', root).forEach((el) => {
    if (el.dataset.magnetBound) return;
    el.dataset.magnetBound = '1';
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ------------------------------------------------------------ Section transitions */
/**
 * Clicking an in-page link plays a saffron clip-path wipe, jumps to the target
 * while covered, then reveals it. Short hops (or reduced motion) just smooth-scroll.
 */
export function initTransitions() {
  const wipe = $('#wipe');
  let busy = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (a.dataset.tab) emit('reserve-tab', a.dataset.tab);
    history.replaceState(null, '', id);
    const distance = Math.abs(target.getBoundingClientRect().top);
    if (prefersReducedMotion || busy || distance < innerHeight * 1.5) {
      scrollToTarget(target);
      focusSection(target);
      return;
    }
    busy = true;
    gsap.timeline({ onComplete: () => { busy = false; focusSection(target); } })
      .set(wipe, { clipPath: 'inset(100% 0% 0% 0%)' })
      .to(wipe, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'power3.inOut' })
      .fromTo('.wipe__logo', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3 }, '-=0.2')
      .add(() => { scrollToTarget(target, { immediate: true }); ScrollTrigger.update(); })
      .to(wipe, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'power3.inOut', delay: 0.1 })
      .to('.wipe__logo', { autoAlpha: 0, duration: 0.2 }, '<');
  });
}

/** Move keyboard focus to the section so screen-reader / keyboard users land there too. */
function focusSection(el) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/* ------------------------------------------------------------ Theme */
export function initTheme() {
  const btn = $('#theme-toggle');
  const sync = () => btn.setAttribute('aria-pressed', String(document.documentElement.classList.contains('dark')));
  sync();
  btn.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('hg-theme', dark ? 'dark' : 'light'); } catch {}
    sync();
    emit('theme', dark);
  });
}
export const isDark = () => document.documentElement.classList.contains('dark');
