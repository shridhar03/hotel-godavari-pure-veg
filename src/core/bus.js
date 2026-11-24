/** Tiny pub/sub so modules can react to global state (language, theme) without coupling. */
const listeners = new Map();
export const on = (evt, fn) => {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
};
export const emit = (evt, payload) => listeners.get(evt)?.forEach((fn) => fn(payload));
