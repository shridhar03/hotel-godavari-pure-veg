/**
 * Hotel Godavari Pure Veg: app entry.
 *
 * Boot order
 *  1. Global UI (theme, i18n, smooth scroll, navbar, cursor…), instant
 *  2. Preloader: track content JSON + fonts + the hero river scene → % progress
 *  3. Render sections from JSON
 *  4. Preloader exits → hero intro timeline
 *  5. Heavier 3D scenes (dish carousel, room preview, gallery) mount lazily
 *     as their sections approach the viewport
 */
import './styles/main.css';
import { loadJSON } from './core/data.js';
import { initI18n } from './core/i18n.js';
import { initScroll, ScrollTrigger } from './core/scroll.js';
import { initNavbar, initCursor, initMagnetic, initScrollProgress, initTransitions, initTheme } from './components/ui.js';
import { createPreloader } from './components/preloader.js';
import { createRiver, playHeroIntro, initAbout } from './components/hero.js';
import { initReveals } from './components/reveals.js';
import { initSignature } from './components/signature.js';
import { initMenu } from './components/menu.js';
import { initRooms } from './components/rooms.js';
import { initReservation } from './components/reservation.js';
import { initEvents, initGallery, initTestimonials, initContact, initSpecial, initNewsletter } from './components/sections.js';

// Don't restore a mid-page scroll position under the preloader
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

async function boot() {
  initTheme();
  initI18n();
  initScroll();
  const preloader = createPreloader();

  /* ---- Preload everything the first screen needs, reporting progress */
  const tasks = {
    site: loadJSON('site'),
    special: loadJSON('special'),
    menu: loadJSON('menu'),
    signature: loadJSON('signature'),
    rooms: loadJSON('rooms'),
    gallery: loadJSON('gallery'),
    testimonials: loadJSON('testimonials'),
    fonts: document.fonts?.ready ?? Promise.resolve(),
    river: createRiver(),
    heroImg: new Promise((res) => {
      // the hero fallback image only matters when WebGL is off; otherwise resolve immediately
      const img = document.querySelector('.river-fallback');
      if (img.complete) res();
      else { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }
    }),
  };
  let done = 0;
  const total = Object.keys(tasks).length;
  const tracked = Object.fromEntries(
    Object.entries(tasks).map(([k, p]) => [
      k,
      Promise.resolve(p)
        .catch((e) => { console.error(`[boot] ${k} failed`, e); return null; })
        .finally(() => preloader.setProgress(++done / total)),
    ]),
  );
  // A minimum display time lets the diya actually be seen; a timeout guarantees we never hang
  const minTime = new Promise((r) => setTimeout(r, 1400));
  const all = Promise.all(Object.values(tracked));
  await Promise.race([Promise.all([all, minTime]), new Promise((r) => setTimeout(r, 8000))]);

  const [site, special, menu, signature, rooms, gallery, testimonials] = await Promise.all(
    ['site', 'special', 'menu', 'signature', 'rooms', 'gallery', 'testimonials'].map((k) => tracked[k]),
  );

  /* ---- Render sections (each guarded so one bad JSON file can't break the page) */
  const safe = (name, fn) => { try { fn(); } catch (e) { console.error(`[${name}]`, e); } };
  if (special) safe('special', () => initSpecial(special));
  safe('navbar', initNavbar);
  safe('about', initAbout);
  if (signature) safe('signature', () => initSignature(signature));
  if (menu) safe('menu', () => initMenu(menu));
  if (rooms) safe('rooms', () => initRooms(rooms));
  if (site) safe('events', () => initEvents(site));
  if (gallery) safe('gallery', () => initGallery(gallery));
  if (testimonials) safe('testimonials', () => initTestimonials(testimonials));
  if (rooms && site) safe('reservation', () => initReservation(rooms, site));
  if (site) safe('contact', () => initContact(site));
  safe('newsletter', initNewsletter);
  safe('reveals', initReveals);
  safe('progress', initScrollProgress);
  safe('cursor', initCursor);
  safe('magnetic', () => initMagnetic());
  safe('transitions', initTransitions);

  await preloader.finish();
  playHeroIntro();
  ScrollTrigger.refresh();

  // Deep links (#menu etc.) once layout is final
  if (location.hash && location.hash.length > 1) {
    const { scrollToTarget } = await import('./core/scroll.js');
    const el = document.querySelector(location.hash);
    if (el) setTimeout(() => scrollToTarget(el, { immediate: true }), 50);
  }
}

boot();
