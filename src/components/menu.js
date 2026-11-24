/**
 * Full menu: category tabs, live search, Jain / no onion-garlic filter.
 * Filtering uses GSAP Flip so cards glide to their new places, new ones scale in
 * and removed ones fade out.
 */
import { gsap, ScrollTrigger } from '../core/scroll.js';
import { Flip } from 'gsap/Flip';
import { prefersReducedMotion } from '../core/env.js';
import { inr } from '../core/data.js';
import { t } from '../core/i18n.js';
import { on } from '../core/bus.js';

gsap.registerPlugin(Flip);

const TAG_LABEL = { jain: ['tag--jain', 'Jain'], nog: ['tag--nog', 'No onion-garlic'], spicy: ['tag--spicy', '🌶 Spicy'], bestseller: ['tag--best', '★ Bestseller'] };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function initMenu(data) {
  const grid = document.getElementById('menu-grid');
  const filters = document.getElementById('menu-filters');
  const search = document.getElementById('menu-search');
  const jain = document.getElementById('menu-jain');
  const empty = document.getElementById('menu-empty');
  const cats = ['All', ...data.categories];
  const state = { cat: 'All', q: '', jain: false };

  // Render every item once; filtering toggles visibility so Flip can animate positions.
  grid.innerHTML = data.items
    .map(
      (it) => `<li class="menu-item" data-cat="${esc(it.category)}" data-tags="${it.tags.join(' ')}" data-search="${esc((it.name + ' ' + it.local + ' ' + it.description + ' ' + it.category).toLowerCase())}">
        <div class="menu-item__head">
          <h3 class="menu-item__name">${esc(it.name)}<span class="menu-item__local" lang="mr">${esc(it.local)}</span></h3>
          <p class="menu-item__price">${inr(it.price)}</p>
        </div>
        <p class="menu-item__desc">${esc(it.description)}</p>
        <ul class="menu-item__tags" role="list">
          <li><span class="veg-badge veg-badge--sm" title="Pure veg"><span class="veg-mark" aria-hidden="true"></span>Veg</span></li>
          ${it.tags.map((tg) => (TAG_LABEL[tg] ? `<li class="tag ${TAG_LABEL[tg][0]}">${TAG_LABEL[tg][1]}</li>` : '')).join('')}
        </ul>
      </li>`,
    )
    .join('');
  const items = [...grid.children];

  const renderTabs = () => {
    filters.innerHTML = cats
      .map((c) => `<button role="tab" type="button" aria-selected="${c === state.cat}" tabindex="${c === state.cat ? 0 : -1}" data-cat="${esc(c)}">${c === 'All' ? t('menu.all') : esc(c)}</button>`)
      .join('');
  };
  renderTabs();
  on('lang', renderTabs);

  let refreshTimer;
  function apply(animate = true) {
    const flipState = animate && !prefersReducedMotion ? Flip.getState(items) : null;
    const q = state.q.trim().toLowerCase();
    let shown = 0;
    items.forEach((el) => {
      const okCat = state.cat === 'All' || el.dataset.cat === state.cat;
      const okQ = !q || el.dataset.search.includes(q);
      const tags = el.dataset.tags.split(' ');
      const okJ = !state.jain || tags.includes('jain') || tags.includes('nog');
      const visible = okCat && okQ && okJ;
      el.style.display = visible ? '' : 'none';
      if (visible) shown++;
    });
    empty.classList.toggle('hidden', shown > 0);
    // the section height changed: recompute every scroll trigger below it
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), flipState ? 700 : 0);
    if (flipState) {
      Flip.from(flipState, {
        duration: 0.6,
        ease: 'power3.inOut',
        absolute: true,
        nested: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.92, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.02, ease: 'power3.out' }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.92, duration: 0.3 }),
      });
    }
  }

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat;
    filters.querySelectorAll('button').forEach((x) => {
      const sel = x === b;
      x.setAttribute('aria-selected', String(sel));
      x.tabIndex = sel ? 0 : -1;
    });
    b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    apply();
  });
  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern)
  filters.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const btns = [...filters.querySelectorAll('button')];
    let i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowRight') i = (i + 1) % btns.length;
    if (e.key === 'ArrowLeft') i = (i - 1 + btns.length) % btns.length;
    if (e.key === 'Home') i = 0;
    if (e.key === 'End') i = btns.length - 1;
    e.preventDefault();
    btns[i].focus();
    btns[i].click();
  });

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = search.value; apply(); }, 120);
  });
  jain.addEventListener('change', () => { state.jain = jain.checked; apply(); });

  apply(false);
}
