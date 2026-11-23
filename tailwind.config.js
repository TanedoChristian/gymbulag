/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        floor: {
          DEFAULT: 'rgb(217 221 227 / <alpha-value>)',
          soft: 'rgb(236 239 243 / <alpha-value>)',
          mute: 'rgb(186 192 201 / <alpha-value>)',
          dark: 'rgb(10 12 14 / <alpha-value>)',
        },
        rack: {
          DEFAULT: 'rgb(10 12 14 / <alpha-value>)',
          raised: 'rgb(18 22 26 / <alpha-value>)',
          edge: 'rgb(36 42 50 / <alpha-value>)',
        },
        steel: {
          DEFAULT: 'rgb(17 20 24 / <alpha-value>)',
          soft: 'rgb(42 48 56 / <alpha-value>)',
          mute: 'rgb(107 115 128 / <alpha-value>)',
          bright: 'rgb(232 236 240 / <alpha-value>)',
        },
        volt: {
          DEFAULT: 'rgb(198 240 0 / <alpha-value>)',
          300: 'rgb(220 255 90 / <alpha-value>)',
          400: 'rgb(212 255 58 / <alpha-value>)',
          500: 'rgb(198 240 0 / <alpha-value>)',
          600: 'rgb(168 204 0 / <alpha-value>)',
          700: 'rgb(107 130 0 / <alpha-value>)',
          ink: 'rgb(10 12 14 / <alpha-value>)',
        },
        plate: {
          DEFAULT: 'rgb(255 77 26 / <alpha-value>)',
          400: 'rgb(255 110 64 / <alpha-value>)',
          500: 'rgb(255 77 26 / <alpha-value>)',
          600: 'rgb(220 58 14 / <alpha-value>)',
          700: 'rgb(180 42 10 / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'ui-sans-serif', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        app: '42rem',
        'app-wide': '56rem',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(17,20,24,0.06), 0 10px 28px -18px rgba(17,20,24,0.45)',
        'panel-dark': '0 1px 0 rgba(255,255,255,0.04)',
        rack: '0 12px 40px -20px rgba(0,0,0,0.65)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(14px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)' } },
        'volt-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(198,240,0,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(198,240,0,0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 180ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
        pop: 'pop 220ms ease-out',
        'volt-pulse': 'volt-pulse 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
