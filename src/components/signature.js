/**
 * Signature dishes: accessible dish list + lazy-loaded 3D carousel + detail modal.
 */
import { use3D, prefersReducedMotion } from '../core/env.js';
import { asset, inr } from '../core/data.js';
import { on } from '../core/bus.js';
import { createModal } from './modal.js';
import { lazyMount } from './lazy.js';

export function initSignature(data) {
  const dishes = data.dishes;
  const list = document.getElementById('dish-list');
  const label = document.getElementById('carousel-label');
  let carousel = null;
  let current = 0;

  // Modal
  const modalEl = document.getElementById('dish-modal');
  const modal = createModal(modalEl);
  const openDish = (d) => {
    const img = document.getElementById('dish-modal-img');
    img.src = asset(d.image);
    img.alt = `${d.name} (placeholder photo)`;
    document.getElementById('dish-modal-title').textContent = d.name;
    document.getElementById('dish-modal-local').textContent = d.local;
    document.getElementById('dish-modal-desc').textContent = d.description;
    document.getElementById('dish-modal-price').textContent = inr(d.price);
    document.getElementById('dish-modal-tags').innerHTML = d.tags
      .map((t) => `<li class="tag ${/jain|onion/i.test(t) ? 'tag--jain' : /spicy/i.test(t) ? 'tag--spicy' : /best/i.test(t) ? 'tag--best' : 'tag--nog'}">${t}</li>`)
      .join('');
    modal.show();
  };

  const setCurrent = (i) => {
    current = i;
    label.textContent = `${dishes[i].name} · ${inr(dishes[i].price)}`;
    list.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };

  // Accessible list (also the non-WebGL fallback, styled as cards there)
  list.innerHTML = dishes
    .map(
      (d, i) => `<li><button type="button" data-i="${i}" aria-label="${d.name}, ${inr(d.price)}. View details">
        ${use3D ? '' : `<img src="${asset(d.image)}" alt="" width="400" height="400" loading="lazy" style="aspect-ratio:1;object-fit:cover;width:100%">`}
        <span ${use3D ? '' : 'style="display:block;padding:.75rem 1rem"'}>${d.name}</span></button></li>`,
    )
    .join('');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const i = Number(b.dataset.i);
    carousel?.goTo(i);
    setCurrent(i);
    openDish(dishes[i]);
  });

  document.getElementById('carousel-prev').addEventListener('click', () => (carousel ? carousel.prev() : setCurrent((current - 1 + dishes.length) % dishes.length)));
  document.getElementById('carousel-next').addEventListener('click', () => (carousel ? carousel.next() : setCurrent((current + 1) % dishes.length)));
  // keyboard: arrows when the carousel region has focus
  document.getElementById('carousel').addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight') carousel?.next();
    if (e.key === 'ArrowLeft') carousel?.prev();
  });
  setCurrent(0);

  if (!use3D) return;
  lazyMount(document.getElementById('carousel'), async () => {
    const { DishCarousel } = await import('../scenes/DishCarousel.js');
    carousel = new DishCarousel(document.getElementById('carousel-canvas'), dishes, {
      reduced: prefersReducedMotion,
      onSelect: (d) => openDish(d),
      onChange: (_d, i) => setCurrent(i),
    });
  });
  on('lang', () => setCurrent(current));
}
