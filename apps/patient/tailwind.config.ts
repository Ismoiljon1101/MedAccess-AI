import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Deep ink palette (matches clinic app) ───────────────────
        ink: {
          950: '#070a13',
          900: '#0b0f1a',
          800: '#111727',
          700: '#1a2236',
          600: '#243049',
          500: '#3a4666',
          400: '#5b6786',
          300: '#8893b3',
          200: '#b8bfd5',
          100: '#e3e6f0',
        },
        // ── Teal accent (same family as clinic, slightly lighter for patient) ──
        brand: {
          50:  '#f0fdfb',
          100: '#ccfbf4',
          400: '#4cd3c2',
          500: '#22b8a3',
          600: '#129079',
          700: '#0a6659',
        },
        // ── surface aliases → ink tokens ────────────────────────────
        surface: {
          900: '#0b0f1a',
          800: '#111727',
          700: '#1a2236',
          600: '#243049',
        },
        ok:     { 400: '#34d399', 500: '#10b981' },
        warn:   { 400: '#fbbf24', 500: '#f59e0b' },
        danger: { 400: '#f87171', 500: '#ef4444' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow:  '0 0 28px -8px rgba(34, 184, 163, 0.45)',
        'glow-sm': '0 0 14px -4px rgba(34, 184, 163, 0.30)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
} satisfies Config;
