/**
 * Generic scroll reveals: split-text headings, image/card mask reveals.
 * Initial hidden states are applied from JS only, so content is always visible
 * if JavaScript fails or motion is reduced.
 */
import { gsap, ScrollTrigger } from '../core/scroll.js';
import { prefersReducedMotion } from '../core/env.js';
import { on } from '../core/bus.js';

/**
 * Split an element's text into per-character spans, keeping words together
 * (so lines still wrap naturally) and preserving an accessible label.
 * Devanagari is split per grapheme cluster so matras stay attached.
 */
export function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  // screen readers read this copy; the animated per-char spans are aria-hidden
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  el.appendChild(sr);
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const chars = [];
  text.split(/(\s+)/).forEach((word) => {
    if (/^\s+$/.test(word)) { el.appendChild(document.createTextNode(' ')); return; }
    const w = document.createElement('span');
    w.style.display = 'inline-block';
    w.style.whiteSpace = 'nowrap';
    w.setAttribute('aria-hidden', 'true');
    const parts = seg ? [...seg.segment(word)].map((s) => s.segment) : [...word];
    parts.forEach((c) => {
      const s = document.createElement('span');
      s.className = 'char';
      s.style.display = 'inline-block';
      s.textContent = c;
      w.appendChild(s);
      chars.push(s);
    });
    el.appendChild(w);
  });
  return chars;
}

export function initReveals() {
  if (prefersReducedMotion) return;

  // Section headings: chars rise in
  document.querySelectorAll('.split-reveal').forEach((el) => {
    const run = () => {
      const chars = splitChars(el);
      gsap.from(chars, {
        yPercent: 90,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.018,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    };
    run();
  });

  // Eyebrows & leads fade up
  gsap.utils.toArray('.section-head .eyebrow, .section-head .section-lead').forEach((el) => {
    gsap.from(el, { y: 20, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  // Mask reveals for cards (clip-path wipe upward)
  ScrollTrigger.batch('.reveal-mask', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.fromTo(els, { clipPath: 'inset(100% 0% 0% 0% round 16px)', y: 40 }, { clipPath: 'inset(0% 0% 0% 0% round 16px)', y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 }),
  });

  // After a language switch headings are plain text again; make sure nothing stays hidden.
  on('lang', () => ScrollTrigger.refresh());
}

/** Image mask reveal for elements rendered later (menu, rooms, gallery). */
export function revealList(els, opts = {}) {
  if (prefersReducedMotion || !els.length) return;
  ScrollTrigger.batch(els, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.fromTo(batch, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08, ...opts }),
  });
}
