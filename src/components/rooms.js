/**
 * Rooms & Stay: room cards with amenities + a lazy-loaded 3D room preview.
 */
import { use3D, prefersReducedMotion } from '../core/env.js';
import { asset, inr } from '../core/data.js';
import { t, tl } from '../core/i18n.js';
import { on, emit } from '../core/bus.js';
import { lazyMount } from './lazy.js';
import { revealList } from './reveals.js';

// Minimal line icons (24×24, stroke = currentColor)
const ICONS = {
  wifi: ['Free Wi-Fi', '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>'],
  ac: ['Air conditioning', '<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 4l3 2 3-2M9 20l3-2 3 2"/>'],
  tv: ['Smart TV', '<rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8"/>'],
  tea: ['Tea & coffee', '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>'],
  shower: ['Rain shower', '<path d="M4 20V8a4 4 0 0 1 8 0M9 8h6M10 12v1M13 12v1M16 12v1M10 16v1M13 16v1M16 16v1"/>'],
  bath: ['Bathtub', '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3zM6 12V5a2 2 0 0 1 4 0"/>'],
  desk: ['Work desk', '<path d="M3 8h18M5 8v12M19 8v12M5 13h6"/>'],
  view: ['River view', '<path d="M2 16c3-2 5-2 8 0s5 2 8 0 3-1 4-1M2 20c3-2 5-2 8 0s5 2 8 0"/><circle cx="16" cy="7" r="3"/>'],
  sofa: ['Sofa lounge', '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>'],
};

export function initRooms(rooms) {
  const wrap = document.getElementById('room-cards');
  const fallback = document.getElementById('room-fallback');
  let preview = null;
  let active = rooms[0];

  const render = () => {
    wrap.innerHTML = rooms
      .map(
        (r) => `<div class="room-card" role="listitem" data-id="${r.id}" aria-current="${r.id === active.id}">
        <div class="room-card__top">
          <div>
            <h3 class="room-card__name">${tl(r.name)}</h3>
            <p class="room-card__meta">${r.size} · ${r.bed} · ${r.guests} ${t('rooms.guests')}</p>
          </div>
          <p class="room-card__price">${inr(r.price)}<small>${t('rooms.night')}</small></p>
        </div>
        <p class="room-card__desc">${r.description}</p>
        <ul class="amenities" role="list">${r.amenities
          .map((a) => (ICONS[a] ? `<li class="amenity"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[a][1]}</svg>${ICONS[a][0]}</li>` : ''))
          .join('')}</ul>
        <div class="room-card__actions">
          <a href="#reserve" class="btn btn--saffron btn--sm" data-transition data-room="${r.id}" data-tab="room">${t('rooms.check')}</a>
          <button type="button" class="room-card__select" data-view="${r.id}" aria-pressed="${r.id === active.id}">${t('rooms.view')}</button>
        </div>
      </div>`,
      )
      .join('');
  };

  const select = (id) => {
    active = rooms.find((r) => r.id === id) || rooms[0];
    wrap.querySelectorAll('.room-card').forEach((c) => c.setAttribute('aria-current', String(c.dataset.id === active.id)));
    wrap.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === active.id)));
    fallback.src = asset(active.image);
    fallback.alt = `${tl(active.name)} (placeholder photo)`;
    document.getElementById('room-canvas').setAttribute('aria-label', `Interactive 3D preview of the ${tl(active.name)}`);
    preview?.setRoom(active);
  };

  render();
  select(active.id);
  revealList([...wrap.children]);

  wrap.addEventListener('click', (e) => {
    const check = e.target.closest('[data-room]');
    if (check) emit('reserve-room', check.dataset.room);
    const card = e.target.closest('.room-card');
    if (card) select(card.dataset.id);
  });
  on('lang', () => { render(); select(active.id); });

  if (!use3D) return;
  lazyMount(document.getElementById('room-viewer'), async () => {
    const { RoomPreview } = await import('../scenes/RoomPreview.js');
    preview = new RoomPreview(document.getElementById('room-canvas'), { reduced: prefersReducedMotion });
    preview.setRoom(active);
  });
}
