# Hotel Godavari Pure Veg

An immersive, production-ready frontend for **Hotel Godavari Pure Veg**, a premium 100% pure-vegetarian hotel and restaurant inspired by the Godavari river. [three.js](https://github.com/mrdoob/three.js) is the core 3D engine.

**Stack:** Vite + vanilla JavaScript (ES modules) · three.js with custom GLSL shaders · GSAP + ScrollTrigger + Flip · Lenis smooth scrolling · Tailwind CSS. There is no backend: content is loaded from JSON files in `public/data/`.

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve dist/ at http://localhost:4173
```

Requires Node 18+.

Testing switches: `?3d=0` forces the static (no-WebGL) fallback and `?3d=1` forces full 3D on a device that would otherwise get the fallback.

## What's inside

| Section | Highlights |
| --- | --- |
| Preloader | three.js diya with a flame shader whose brightness follows real load progress (%), then an iris transition into the hero |
| Hero | Stylised Godavari: shader water (vertex waves, fresnel, sky reflection, sun/moon specular, diya light streaks), floating diyas and lotuses that bob on the same wave function, GPU fireflies, ghat temple, mouse/tilt parallax, staggered split-text heading |
| About / Story | The river camera travels downstream as you scroll; glass panels fade in; 25+ / 150+ / 50K+ counters |
| Signature dishes | 3D lazy-susan of six procedural plates (thali, misal pav, puran poli, paneer tikka, dosa, mithai). Hover lifts, spins and glows a plate; click opens a modal with price (₹) and Jain / no onion-garlic tags. Drag, swipe and arrow controls |
| Full menu | 40 dishes, 8 categories, live search, Jain / no onion-garlic toggle, GSAP Flip filter animations |
| Rooms | Deluxe, Executive and Family Suite cards with amenity icons and price per night; orbitable, auto-rotating 3D room dioramas (walls fade so you can see inside) |
| Banquet & events | Lazy-loaded, muted, looped background video with gradient overlay and parallax |
| Gallery | WebGL planes synced to the DOM images with a ripple + RGB-split hover shader; FLIP lightbox with keyboard and swipe |
| Testimonials | Auto-sliding Google-review-style cards with star ratings (pauses on hover, focus and off-screen) |
| Reservations | Table booking / room inquiry tabs, Indian mobile validation, animated success state, prefilled WhatsApp message |
| Contact & footer | Lazy Google Map iframe, hours, socials, newsletter, pure-veg badge |

Site-wide: custom cursor, magnetic buttons, saffron scroll-progress bar, saffron clip-path wipe between distant sections, shrinking glass navbar, animated hamburger menu, **English / मराठी / हिंदी** toggle, **light (golden hour) / dark (night river with glowing diyas)** theme, "Today's Special" banner, and the green 100% Pure Veg mark throughout.

## Folder structure

```
index.html                 Markup, SEO meta, Open Graph, JSON-LD (Restaurant + Hotel)
src/
  main.js                  Boot sequence: preload → render sections → hero intro → lazy 3D
  core/                    env detection, Lenis/GSAP setup, i18n, JSON loading, three.js helpers, GLB/KTX2 loaders
  components/              One module per section (hero, menu, rooms, reservation, …) plus UI chrome and modal
  scenes/                  three.js scenes: PreloaderScene, RiverScene, DishCarousel, RoomPreview, GalleryGL, props
  shaders/                 GLSL: water, sky, flame, fireflies, gallery ripple, shared noise (commented)
  i18n/strings.js          EN / MR / HI UI strings
  styles/main.css          Tailwind layers + design tokens (light and dark)
public/
  data/                    menu, signature, rooms, gallery, testimonials, special, site (all editable JSON)
  images/                  PLACEHOLDER images (each is labelled "PLACEHOLDER · replace …")
  video/                   PLACEHOLDER banquet loop
  models/                  Drop DRACO-compressed .glb files here (see models/README.md)
  textures/                Optional WebP / KTX2 textures
```

## Replacing placeholders

Everything you need to swap is marked **PLACEHOLDER**:

1. **Business details:** edit `public/data/site.json` (`[ADDRESS]`, `[PHONE]`, `[EMAIL]`, WhatsApp number, Google Maps embed URL, social links), and the same placeholders in the JSON-LD block, canonical URL and `og:` tags in `index.html`, plus `public/robots.txt` and `public/sitemap.xml`.
2. **Photos:** replace files in `public/images/` keeping the same names, or point the JSON at new paths. WebP at about 1600px wide, quality 75, is a good target.
3. **Banquet video:** replace `public/video/banquet-placeholder.mp4` (H.264, muted, 720p, under 3 MB) and/or change `banquetVideo` in `site.json`.
4. **3D models:** add `"model": "models/thali.glb"` to a dish in `signature.json` or a room in `rooms.json`. Models load lazily through `GLTFLoader` + `DRACOLoader` + `KTX2Loader`; until then procedural placeholders render.
5. **Logo:** the lotus mark is an inline SVG `<symbol id="logo-mark">` in `index.html` and `public/favicon.svg`.
6. **Today's Special:** edit `public/data/special.json`. It is fetched at runtime, so no rebuild is needed; set `"enabled": false` to hide it.
7. **Forms:** the reservation and newsletter forms are client-side only. Look for `TODO` in `src/components/reservation.js` and `sections.js` to POST to your booking system, Formspree, Netlify Forms, etc.
8. **Translations:** `src/i18n/strings.js`. Please have a native speaker review the Marathi and Hindi copy.

## Performance and accessibility notes

- Every renderer caps `devicePixelRatio` at 2 (1.5 on the low-quality tier), and every render loop pauses when its canvas is off-screen (IntersectionObserver) or the tab is hidden.
- The dish carousel, room preview and gallery shaders are code-split and only mount when their section approaches the viewport. three.js, GSAP and Lenis are split into long-cacheable chunks.
- Low-end devices (≤2 GB RAM, Save-Data, 2G) and browsers without WebGL get the static image/video fallback; all content stays in plain, accessible HTML.
- `prefers-reduced-motion`: Lenis, cursor, magnetic buttons, split text, parallax, auto-slides and video are disabled, and 3D scenes render still frames.
- Geometries, materials, textures and renderers are disposed on unmount (`disposeObject` / `disposeRenderer` in `src/core/three-utils.js`).
- Semantic landmarks, skip link, visible focus states, ARIA tabs, focus-trapped modals (Esc to close), labelled form errors, alt text everywhere.

## Deploy

The build is static and uses a relative base (`./`), so it works from a domain root or any sub-path.

**GitHub Pages:** `.github/workflows/deploy-pages.yml` builds and deploys on every push to `main` (or run it manually from the Actions tab). One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The site is then served at `https://shridhar03.github.io/hotel-godavari-pure-veg/`.

**Vercel:** import the repo; framework preset **Vite**, build command `npm run build`, output directory `dist`. Or run `npx vercel --prod`.

**Netlify:** build command `npm run build`, publish directory `dist`. Or run `npx netlify deploy --prod --dir=dist`. Netlify Forms can be enabled by adding `data-netlify="true"` to the forms.

After deploying, update the canonical URL, `og:image` absolute URL, JSON-LD `@id`s and the sitemap with your real domain.

## License

To be decided by the owner.
