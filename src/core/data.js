/**
 * Loads JSON content from /public/data at runtime so the client can edit content
 * (menu, rooms, special…) without rebuilding the site.
 */
const cache = new Map();
export function loadJSON(name) {
  if (!cache.has(name)) {
    const url = new URL(`data/${name}.json`, document.baseURI).href;
    cache.set(
      name,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${name}.json (${r.status})`);
        return r.json();
      }),
    );
  }
  return cache.get(name);
}

/** Resolve a public asset path relative to the page (works under any sub-path). */
export const asset = (p) => new URL(p, document.baseURI).href;

/** Format INR prices, e.g. ₹1,299 */
export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
