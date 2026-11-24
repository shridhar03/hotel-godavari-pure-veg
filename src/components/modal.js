/**
 * Accessible modal helper: focus trap, Esc / backdrop to close, restores focus,
 * locks smooth-scroll while open, animated in/out with GSAP.
 */
import { gsap, stopScroll, startScroll } from '../core/scroll.js';
import { prefersReducedMotion } from '../core/env.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function createModal(root, { onClose, animateIn, animateOut } = {}) {
  let lastFocus = null;
  let open = false;

  const keydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });

  function show() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    root.hidden = false;
    stopScroll();
    document.addEventListener('keydown', keydown);
    if (animateIn) animateIn();
    else if (!prefersReducedMotion) {
      gsap.fromTo(root.querySelector('.modal__backdrop'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
      gsap.fromTo(root.querySelector('.modal__card'), { y: 40, scale: 0.96, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'expo.out' });
    }
    requestAnimationFrame(() => (root.querySelector('[data-autofocus]') || root.querySelector(FOCUSABLE))?.focus());
  }

  function close() {
    if (!open) return;
    open = false;
    document.removeEventListener('keydown', keydown);
    const done = () => {
      root.hidden = true;
      startScroll();
      lastFocus?.focus?.({ preventScroll: true });
      onClose?.();
    };
    if (animateOut) animateOut(done);
    else if (prefersReducedMotion) done();
    else {
      gsap.to(root.querySelector('.modal__card'), { y: 30, autoAlpha: 0, duration: 0.3, ease: 'power2.in' });
      gsap.to(root.querySelector('.modal__backdrop'), { autoAlpha: 0, duration: 0.35, onComplete: done });
    }
  }

  return { show, close, isOpen: () => open };
}
