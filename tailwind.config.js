/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        river: { DEFAULT: '#0E5E6F', 50: '#E8F4F6', 100: '#C6E3E8', 300: '#5FA9B7', 500: '#0E5E6F', 700: '#0A4552', 800: '#073440', 900: '#04212A', 950: '#021318' },
        saffron: { DEFAULT: '#F4A300', 50: '#FFF6E0', 100: '#FFE9B3', 300: '#FFC94D', 500: '#F4A300', 600: '#C98500', 700: '#9A6600' },
        cream: { DEFAULT: '#FFF8EC', 100: '#FFF8EC', 200: '#F7ECD8', 300: '#EBDCC0' },
        leaf: { DEFAULT: '#3A7D44', 300: '#7DBB86', 500: '#3A7D44', 700: '#265A2E' },
        charcoal: { DEFAULT: '#1E1E1E', 600: '#3A3A3A', 400: '#6B6B6B' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Tiro Devanagari Hindi"', 'Georgia', 'serif'],
        sans: ['Inter', '"Tiro Devanagari Hindi"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        deva: ['"Tiro Devanagari Hindi"', 'serif'],
      },
      screens: { xs: '360px', '3xl': '1920px', '4k': '2560px' },
      boxShadow: {
        glow: '0 0 40px -6px rgba(244,163,0,.55)',
        soft: '0 20px 60px -20px rgba(4,33,42,.35)',
      },
    },
  },
  plugins: [],
};
