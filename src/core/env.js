/**
 * Environment / capability detection used to decide how much 3D and motion we run.
 */
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;

export const prefersReducedMotion = mq('(prefers-reduced-motion: reduce)');
export const isTouch = mq('(hover: none), (pointer: coarse)');
export const isMobile = mq('(max-width: 767px)');

/** True if a WebGL2 or WebGL1 context can be created. */
export const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();

/**
 * Heuristic for low-end devices: few cores, little memory, or the user asked to save data.
 * On these we show the static image/video fallback instead of the heavy hero scene.
 * Force full 3D with ?3d=1, or force the fallback with ?3d=0 (handy for testing).
 */
export const isLowEnd = (() => {
  const q = new URLSearchParams(location.search).get('3d');
  if (q === '1') return false;
  if (q === '0') return true;
  const conn = navigator.connection || {};
  if (conn.saveData) return true;
  if (/(^|-)2g$/.test(conn.effectiveType || '')) return true;
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (mem && mem <= 2) || (isMobile && cores && cores <= 3);
})();

/** Whether the big decorative WebGL scenes should run. */
export const use3D = hasWebGL && !isLowEnd;

/** Quality tier for scenes (particle counts, geometry detail). */
export const quality = isMobile ? 'low' : 'high';
