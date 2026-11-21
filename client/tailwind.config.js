/** @type {import('tailwindcss').Config} */
// Colours and fonts taken from the Dailykart Figma file.
// Each colour is a CSS variable (see index.css), so light and dark mode
// swap the whole palette by toggling the "dark" class on <html>.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['"Yatra One"', 'Inter', 'serif'],
      },
      colors: {
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), faint: v('ink-faint') },
        cream: { DEFAULT: v('cream'), deep: v('cream-deep'), line: v('cream-line') },
        saffron: { 50: v('saffron-50'), 100: v('saffron-100'), 300: '#FDCB75', 400: '#FDBA52', 500: '#F9A93A', 600: '#E58E1E' },
        maroon: { 50: v('maroon-50'), 100: v('maroon-100'), 500: v('maroon-500'), 600: v('maroon-600'), 700: v('maroon-700') },
        leaf: { 50: v('leaf-50'), 600: v('leaf-600') },
        // Cards and panels ("white" backgrounds). Text stays true white.
        paper: v('paper'),
        // Fixed dark tint for overlays behind popups, same in both modes.
        shade: '#2A1A15',
        // legacy names still used in a few places
        canvas: v('cream'),
        brand: { 50: v('maroon-50'), 100: v('maroon-100'), 200: v('maroon-100'), 400: v('maroon-500'), 500: v('maroon-500'), 600: v('maroon-600'), 700: v('maroon-700') },
        mint: { 50: v('leaf-50'), 100: v('leaf-50'), 500: v('leaf-600'), 700: v('mint-700') },
        peach: { 50: v('saffron-50'), 100: v('saffron-100'), 500: '#E58E1E', 700: v('peach-700') },
      },
      // bg-white follows the theme (white cards in light mode, dark cards in dark mode).
      backgroundColor: { white: v('paper') },
      boxShadow: {
        card: '0 1px 2px rgba(42,26,21,0.05), 0 6px 18px -10px rgba(42,26,21,0.18)',
        lift: '0 10px 24px -12px rgba(138,38,32,0.45)',
        pop: '0 18px 48px -16px rgba(42,26,21,0.35)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
