/**
 * Reservation form: Table booking / Room inquiry tabs, client-side validation
 * with accessible inline errors, animated success state and a prefilled
 * WhatsApp confirmation message.
 *
 * Nothing is sent to a server. To go live, POST `payload` in onSubmit to your
 * booking API, Formspree, Netlify Forms, Google Apps Script, etc.
 */
import { gsap } from '../core/scroll.js';
import { prefersReducedMotion } from '../core/env.js';
import { inr } from '../core/data.js';
import { t, tl } from '../core/i18n.js';
import { on } from '../core/bus.js';

const SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

export function initReservation(rooms, site) {
  const form = document.getElementById('reserve-form');
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const tabsWrap = document.querySelector('.tabs');
  const success = document.getElementById('reserve-success');
  const summary = document.getElementById('reserve-summary');
  const f = (n) => form.elements[n];
  let type = 'table';

  // Populate selects
  const fmt = (s) => {
    const [h, m] = s.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  f('time').innerHTML = `<option value="">—</option>` + SLOTS.map((s) => `<option value="${s}">${fmt(s)}</option>`).join('');
  const renderRooms = () => {
    const v = f('room').value;
    f('room').innerHTML = `<option value="">—</option>` + rooms.map((r) => `<option value="${r.id}">${tl(r.name)} · ${inr(r.price)}</option>`).join('');
    f('room').value = v;
  };
  renderRooms();
  on('lang', renderRooms);

  // Date: today as the minimum
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  f('date').min = iso;
  f('date').value = iso;

  /* ---- Tabs (WAI-ARIA) */
  const setType = (next, focus = false) => {
    type = next;
    tabsWrap.dataset.active = next;
    tabs.forEach((tb) => {
      const sel = tb.dataset.type === next;
      tb.setAttribute('aria-selected', String(sel));
      tb.tabIndex = sel ? 0 : -1;
      if (sel) { form.setAttribute('aria-labelledby', tb.id); document.getElementById('reserve-panel').setAttribute('aria-labelledby', tb.id); }
      if (sel && focus) tb.focus();
    });
    form.querySelectorAll('[data-only]').forEach((el) => (el.hidden = el.dataset.only !== next));
    f('time').required = next === 'table';
    f('room').required = next === 'room';
    clearErrors();
    if (!prefersReducedMotion) gsap.fromTo(form.querySelectorAll('.field:not([hidden])'), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.03, ease: 'power2.out' });
  };
  tabs.forEach((tb) => tb.addEventListener('click', () => setType(tb.dataset.type)));
  tabsWrap.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    setType(type === 'table' ? 'room' : 'table', true);
  });
  on('reserve-tab', (next) => { showForm(); setType(next); });
  on('reserve-room', (id) => { showForm(); setType('room'); f('room').value = id; });

  /* ---- Validation */
  const setErr = (name, msg) => {
    const field = f(name).closest('.field');
    const err = document.getElementById('e-' + name);
    field.classList.toggle('is-invalid', !!msg);
    f(name).setAttribute('aria-invalid', String(!!msg));
    if (msg) f(name).setAttribute('aria-describedby', 'e-' + name);
    else f(name).removeAttribute('aria-describedby');
    err.textContent = msg || '';
  };
  const clearErrors = () => ['name', 'phone', 'date', 'time', 'guests', 'nights', 'room'].forEach((n) => setErr(n, ''));

  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : t('err.name')),
    // Indian mobile: optional +91 / 0, then 10 digits starting 6-9
    phone: (v) => (/^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/.test(v.trim()) ? '' : t('err.phone')),
    date: (v) => (v && v >= iso ? '' : t('err.date')),
    time: (v) => (type !== 'table' || v ? '' : t('err.time')),
    guests: (v) => (Number(v) >= 1 && Number(v) <= 40 ? '' : t('err.guests')),
    nights: (v) => (type !== 'room' || (Number(v) >= 1 && Number(v) <= 30) ? '' : t('err.nights')),
    room: (v) => (type !== 'room' || v ? '' : t('err.room')),
  };
  // validate a field on blur, and live once it has shown an error
  Object.keys(rules).forEach((n) => {
    f(n).addEventListener('blur', () => f(n).value && setErr(n, rules[n](f(n).value)));
    f(n).addEventListener('input', () => f(n).closest('.field').classList.contains('is-invalid') && setErr(n, rules[n](f(n).value)));
  });

  const card = document.querySelector('.reserve-card');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let firstBad = null;
    Object.keys(rules).forEach((n) => {
      const msg = rules[n](f(n).value);
      setErr(n, msg);
      if (msg && !firstBad) firstBad = f(n);
    });
    if (firstBad) {
      firstBad.focus();
      if (!prefersReducedMotion) gsap.fromTo(card, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      return;
    }

    const payload = Object.fromEntries(new FormData(form));
    payload.type = type;
    // TODO: send `payload` to your backend / form service here.

    const room = rooms.find((r) => r.id === payload.room);
    const when = new Date(payload.date + 'T00:00').toLocaleDateString(document.documentElement.lang === 'en' ? 'en-IN' : document.documentElement.lang + '-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const text =
      type === 'table'
        ? `Table for ${payload.guests} on ${when} at ${fmt(payload.time)}`
        : `${room ? tl(room.name) : 'Room'} for ${payload.guests} guest(s), ${payload.nights} night(s) from ${when}`;
    summary.textContent = `${text}. We'll call ${payload.phone} shortly to confirm.`;
    const wa = `Namaste! I'd like to ${type === 'table' ? 'book a table' : 'enquire about a room'} at Hotel Godavari.\nName: ${payload.name}\nPhone: ${payload.phone}\n${text}${payload.notes ? `\nNotes: ${payload.notes}` : ''}`;
    document.getElementById('success-whatsapp').href = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(wa)}`;

    // Animated success state
    const swap = () => {
      form.hidden = true;
      document.querySelector('.tabs').hidden = true;
      success.hidden = false;
      success.classList.add('is-shown');
      success.focus();
    };
    if (prefersReducedMotion) swap();
    else gsap.to(form, { autoAlpha: 0, y: -10, duration: 0.3, onComplete: () => { swap(); gsap.set(form, { clearProps: 'all' }); gsap.from(success, { autoAlpha: 0, y: 20, duration: 0.6, ease: 'expo.out' }); } });
  });

  function showForm() {
    if (form.hidden) {
      success.hidden = true;
      success.classList.remove('is-shown');
      form.hidden = false;
      document.querySelector('.tabs').hidden = false;
    }
  }
  document.getElementById('reserve-again').addEventListener('click', () => {
    form.reset();
    f('date').value = iso;
    showForm();
    f('name').focus();
  });

  setType('table');
}
