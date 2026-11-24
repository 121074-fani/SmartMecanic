/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: { 950: '#070c12', 900: '#0b121a', 850: '#0f1821', 800: '#111a24', 700: '#1a2633', 600: '#243444', 500: '#34495e' },
        petrol: { 300: '#7fd3d8', 400: '#3fb8c0', 500: '#1a9aa3', 600: '#137b83', 700: '#0f5e65', 900: '#0a3438' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scan: { '0%': { top: '0%' }, '100%': { top: '100%' } },
      },
      animation: {
        'slide-in': 'slide-in 0.28s cubic-bezier(0.2,0.8,0.2,1)',
        'fade-up': 'fade-up 0.35s ease-out both',
        scan: 'scan 1.6s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
