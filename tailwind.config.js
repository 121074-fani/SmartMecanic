/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fg: v('fg'),
        base: { 950: v('base-950'), 900: v('base-900'), 850: v('base-850'), 800: v('base-800'), 700: v('base-700'), 600: v('base-600'), 500: v('base-500') },
        // los tonos de texto neutros se invierten en modo claro
        slate: { 100: v('slate-100'), 200: v('slate-200'), 300: v('slate-300'), 400: v('slate-400'), 500: v('slate-500'), 600: v('slate-600'), 950: '#020617' },
        // acento de la marca: el naranja de "Técnicos del Mañana" (--accent #f5821f); se conserva el nombre de la escala
        petrol: { 300: '#fdba74', 400: '#fb9a45', 500: '#f5821f', 600: '#e8740f', 700: '#c2600a', 900: '#7c3a06' },
        // azul marino de la app del técnico (--navy / --navy2)
        navy: { 700: '#123e6e', 800: '#0b2d52', 900: '#082340' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scan: { '0%': { top: '0%' }, '100%': { top: '100%' } },
      },
      animation: {
        'slide-in': 'slide-in 0.28s cubic-bezier(0.2,0.8,0.2,1)',
        'slide-in-left': 'slide-in-left 0.24s cubic-bezier(0.2,0.8,0.2,1)',
        'fade-up': 'fade-up 0.35s ease-out both',
        scan: 'scan 1.6s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
