import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (Netlify, Vercel, GitHub Pages, a CDN folder…)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Keep three.js and the animation libs in their own long-term cacheable chunks
        manualChunks: {
          three: ['three'],
          anim: ['gsap', 'gsap/ScrollTrigger', 'lenis'],
        },
      },
    },
  },
  server: { host: true },
});
