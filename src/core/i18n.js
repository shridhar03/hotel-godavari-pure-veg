import { STRINGS } from '../i18n/strings.js';
import { emit } from './bus.js';

const SUPPORTED = ['en', 'mr', 'hi'];
let lang = SUPPORTED.includes(document.documentElement.lang) ? document.documentElement.lang : 'en';

export const getLang = () => lang;

/** Translate a key in the current language, falling back to English then the key itself. */
export const t = (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;

/** Pick the right language from a {en, mr, hi} object, or return a plain string as-is. */
export const tl = (v) => (v && typeof v === 'object' ? v[lang] ?? v.en : v);

/** Apply translations to all [data-i18n] / [data-i18n-placeholder] nodes under root. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    // Elements split into characters for animation keep their spans; restore plain text first.
    if (el.textContent !== v) el.textContent = v;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

export function setLang(next) {
  if (!SUPPORTED.includes(next)) return;
  lang = next;
  document.documentElement.lang = next;
  try { localStorage.setItem('hg-lang', next); } catch {}
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === next)));
  applyTranslations();
  emit('lang', next);
}

export function initI18n() {
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(lang);
}
