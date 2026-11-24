/**
 * Smaller sections: Banquet video, Gallery + lightbox, Testimonials slider,
 * Contact details / map, Today's Special banner and the newsletter form.
 */
import { gsap, ScrollTrigger } from '../core/scroll.js';
import { use3D, prefersReducedMotion } from '../core/env.js';
import { asset } from '../core/data.js';
import { t, tl } from '../core/i18n.js';
import { on } from '../core/bus.js';
import { lazyMount } from './lazy.js';
import { createModal } from './modal.js';
import { revealList } from './reveals.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ------------------------------------------------------------ Banquet & events */
export function initEvents(site) {
  const video = document.getElementById('events-video');
  if (site.banquetPoster) video.poster = asset(site.banquetPoster);
  // Lazy-load the (muted, looped) video only when the section approaches, and never with reduced motion / save-data
  const saveData = navigator.connection?.saveData;
  if (site.banquetVideo && !prefersReducedMotion && !saveData) {
    lazyMount(document.getElementById('events'), () => {
      video.src = asset(site.banquetVideo);
      video.load();
      // pause when off-screen to save battery
      new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause())).observe(video);
    }, '300px 0px');
  }
  if (!prefersReducedMotion) {
    gsap.fromTo('.events__media', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '#events', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}

/* ------------------------------------------------------------ Gallery */
export function initGallery(items) {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = items
    .map(
      (g, i) => `<li><button type="button" class="gallery-item" data-i="${i}" aria-label="${esc(g.caption)}: open image. ${esc(g.alt)}">
        <img src="${asset(g.src)}" alt="${esc(g.alt)}" width="1200" height="900" loading="lazy" decoding="async" crossorigin="anonymous" />
        <figcaption aria-hidden="true">${esc(g.caption)}</figcaption>
      </button></li>`,
    )
    .join('');
  const buttons = [...grid.querySelectorAll('.gallery-item')];
  revealList(buttons.map((b) => b.parentElement));

  // ---- Lightbox with a FLIP transition from the clicked thumbnail
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  let index = 0;
  let gl = null;

  const fill = (i) => {
    index = (i + items.length) % items.length;
    img.src = asset(items[index].src);
    img.alt = items[index].alt;
    cap.textContent = items[index].caption;
  };
  const modal = createModal(lb, {
    animateIn: () => {
      if (prefersReducedMotion) return;
      const from = buttons[index].getBoundingClientRect();
      gsap.fromTo(lb, { backgroundColor: 'rgba(2,19,24,0)' }, { backgroundColor: 'rgba(2,19,24,.94)', duration: 0.5 });
      // wait one frame so the <img> has its final layout, then animate from the thumbnail rect
      requestAnimationFrame(() => {
        const to = img.getBoundingClientRect();
        gsap.fromTo(img, {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale: from.width / Math.max(1, to.width),
        }, { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'expo.inOut' });
        gsap.fromTo([cap, ...lb.querySelectorAll('.icon-btn')], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, delay: 0.5 });
      });
    },
    animateOut: (done) => {
      if (prefersReducedMotion) return done();
      const to = buttons[index].getBoundingClientRect();
      const from = img.getBoundingClientRect();
      gsap.to([cap, ...lb.querySelectorAll('.icon-btn')], { autoAlpha: 0, duration: 0.2 });
      gsap.to(img, {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: to.width / Math.max(1, from.width),
        duration: 0.6,
        ease: 'expo.inOut',
      });
      gsap.to(lb, { backgroundColor: 'rgba(2,19,24,0)', duration: 0.6, onComplete: () => { gsap.set(img, { clearProps: 'all' }); done(); } });
    },
  });
  lb.querySelector('.lightbox__close').addEventListener('click', () => modal.close());
  lb.querySelector('.lightbox__prev').addEventListener('click', () => fill(index - 1));
  lb.querySelector('.lightbox__next').addEventListener('click', () => fill(index + 1));
  lb.addEventListener('click', (e) => e.target === lb && modal.close());
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') fill(index + 1);
    if (e.key === 'ArrowLeft') fill(index - 1);
  });
  // swipe on touch
  let sx = 0;
  lb.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) fill(index + (dx < 0 ? 1 : -1));
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.gallery-item');
    if (!b) return;
    fill(Number(b.dataset.i));
    modal.show();
  });

  // ---- WebGL ripple layer (lazy)
  if (!use3D) return;
  const wrap = document.querySelector('.gallery__wrap');
  lazyMount(wrap, async () => {
    const { GalleryGL } = await import('../scenes/GalleryGL.js');
    gl = new GalleryGL(document.getElementById('gallery-canvas'), wrap, buttons.map((el) => ({ el, img: el.querySelector('img') })), { reduced: prefersReducedMotion });
    ScrollTrigger.addEventListener('refresh', () => gl.layout());
  });
}

/* ------------------------------------------------------------ Testimonials */
export function initTestimonials(list) {
  const track = document.getElementById('reviews-track');
  const dots = document.getElementById('reviews-dots');
  const viewport = document.getElementById('reviews-viewport');
  track.innerHTML = list
    .map(
      (r, i) => `<li class="review" aria-roledescription="slide" aria-label="${i + 1} of ${list.length}">
      <article class="review__card">
        <header class="review__head">
          <span class="review__avatar" aria-hidden="true">${esc(r.initials)}</span>
          <div><p class="review__name">${esc(r.name)}</p><p class="review__date">${esc(r.date)}</p></div>
          <span class="review__src">${esc(r.source)}</span>
        </header>
        <p class="stars mt-3" aria-label="Rated ${r.rating} out of 5">${'★'.repeat(r.rating)}<span style="opacity:.3">${'★'.repeat(5 - r.rating)}</span></p>
        <p class="review__text">${esc(r.text)}</p>
      </article></li>`,
    )
    .join('');

  let i = 0;
  let perView = 1;
  let pages = 1;
  const measure = () => {
    perView = innerWidth >= 1200 ? 3 : innerWidth >= 768 ? 2 : 1;
    pages = Math.max(1, list.length - perView + 1);
    dots.innerHTML = Array.from({ length: pages }, (_, k) => `<button role="tab" type="button" aria-label="Show review ${k + 1}" aria-selected="${k === i}"></button>`).join('');
    go(Math.min(i, pages - 1));
  };
  const go = (k) => {
    i = (k + pages) % pages;
    track.style.transform = `translateX(${-(100 / perView) * i}%)`;
    [...dots.children].forEach((d, n) => d.setAttribute('aria-selected', String(n === i)));
    [...track.children].forEach((li, n) => li.toggleAttribute('inert', n < i || n >= i + perView));
  };
  dots.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) go([...dots.children].indexOf(b));
  });
  measure();
  addEventListener('resize', measure);

  // Auto-advance, paused on hover / focus / when off-screen / reduced motion
  if (prefersReducedMotion) return;
  let paused = false;
  let visible = false;
  viewport.addEventListener('pointerenter', () => (paused = true));
  viewport.addEventListener('pointerleave', () => (paused = false));
  viewport.addEventListener('focusin', () => (paused = true));
  viewport.addEventListener('focusout', () => (paused = false));
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(viewport);
  setInterval(() => !paused && visible && !document.hidden && go(i + 1), 5000);
  // swipe
  let sx = 0;
  viewport.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  viewport.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
  });
}

/* ------------------------------------------------------------ Contact + site details */
export function initContact(site) {
  document.querySelectorAll('[data-site]').forEach((el) => {
    const k = el.dataset.site;
    el.textContent = site[k];
    if (k === 'phone') el.href = `tel:${site.phone.replace(/[^\d+]/g, '') || site.phone}`;
    if (k === 'email') el.href = `mailto:${site.email}`;
  });
  const renderHours = () => {
    document.getElementById('hours').innerHTML = site.hours.map((h) => `<dt>${esc(tl(h.label))}</dt><dd>${esc(h.time)}</dd>`).join('');
  };
  renderHours();
  on('lang', renderHours);

  const SOCIAL = {
    instagram: ['Instagram', '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm5.5-3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>'],
    facebook: ['Facebook', '<path d="M14 9V7c0-1 .5-1.5 1.5-1.5H17V2h-2.5C11.5 2 10 4 10 6.5V9H7v3.5h3V22h4v-9.5h3l.5-3.5z"/>'],
    youtube: ['YouTube', '<path d="M22 8.2a3 3 0 0 0-2-2.1C18.2 5.6 12 5.6 12 5.6s-6.2 0-8 .5a3 3 0 0 0-2 2.1A31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2 2.1c1.8.5 8 .5 8 .5s6.2 0 8-.5a3 3 0 0 0 2-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8zM10 15V9l5.2 3z"/>'],
    google: ['Google reviews', '<path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.9 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5L6.4 10A6 6 0 0 1 12 6z"/>'],
  };
  document.getElementById('socials').innerHTML = Object.entries(site.social)
    .map(([k, url]) => (SOCIAL[k] ? `<li><a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${SOCIAL[k][0]} (opens in new tab)"><svg viewBox="0 0 24 24" aria-hidden="true">${SOCIAL[k][1]}</svg></a></li>` : ''))
    .join('');

  // Google Map iframe: only load when the section approaches (saves ~500KB on first load)
  const frame = document.getElementById('map-frame');
  lazyMount(frame, () => (frame.src = site.mapEmbedUrl), '400px 0px');

  // WhatsApp click-to-chat links
  const waText = encodeURIComponent('Namaste! I would like to know more about Hotel Godavari Pure Veg.');
  document.querySelectorAll('#whatsapp-cta, #wa-float').forEach((a) => (a.href = `https://wa.me/${site.whatsapp}?text=${waText}`));
}

/* ------------------------------------------------------------ Today's Special */
export function initSpecial(special) {
  const banner = document.getElementById('special-banner');
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('hg-special') === 'closed'; } catch {}
  if (!special?.enabled || dismissed) return;
  const render = () => {
    document.getElementById('special-title').textContent = tl(special.title) + ':';
    document.getElementById('special-dish').textContent = tl(special.dish);
    document.getElementById('special-price').textContent = special.price ? `₹${special.price}` : '';
    document.getElementById('special-note').textContent = tl(special.note) ? `· ${tl(special.note)}` : '';
  };
  render();
  on('lang', render);
  banner.classList.remove('hidden');
  const setH = () => {
    const visible = !banner.classList.contains('hidden') && !banner.classList.contains('is-tucked');
    document.documentElement.style.setProperty('--banner-h', visible ? banner.offsetHeight + 'px' : '0px');
  };
  setH();
  addEventListener('resize', setH);
  document.getElementById('special-close').addEventListener('click', () => {
    banner.classList.add('hidden');
    try { sessionStorage.setItem('hg-special', 'closed'); } catch {}
    setH();
  });
  // tuck the banner away once the user scrolls down, bring it back at the top
  ScrollTrigger.create({
    start: 120,
    end: 'max',
    onEnter: () => { banner.classList.add('is-tucked'); setH(); },
    onLeaveBack: () => { banner.classList.remove('is-tucked'); setH(); },
  });
}

/* ------------------------------------------------------------ Newsletter */
export function initNewsletter() {
  const form = document.getElementById('newsletter');
  const input = document.getElementById('nl-email');
  const msg = document.getElementById('nl-msg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    input.setAttribute('aria-invalid', String(!ok));
    msg.textContent = ok ? t('footer.thanks') : t('footer.bad');
    msg.style.color = ok ? '#8fd19a' : '#ff9b78';
    if (ok) form.reset();
    // TODO: POST to your newsletter provider (Mailchimp, Brevo, ConvertKit…)
  });
  document.getElementById('year').textContent = new Date().getFullYear();
}
