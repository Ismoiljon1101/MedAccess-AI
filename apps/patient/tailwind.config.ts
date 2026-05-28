import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Deep ink palette — values driven by CSS vars for light/dark ──
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
          600: 'var(--ink-600)',
          500: 'var(--ink-500)',
          400: 'var(--ink-400)',
          300: 'var(--ink-300)',
          200: 'var(--ink-200)',
          100: 'var(--ink-100)',
        },
        // ── Teal accent ──────────────────────────────────────────────
        brand: {
          50:  '#f0fdfb',
          100: '#ccfbf4',
          400: '#4cd3c2',
          500: '#22b8a3',
          600: '#129079',
          700: '#0a6659',
        },
        // ── surface aliases → ink vars ───────────────────────────────
        surface: {
          900: 'var(--ink-900)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
          600: 'var(--ink-600)',
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
  safelist: [
    { pattern: /^(border|bg|text|ring|shadow|placeholder)-(ink|brand|surface|ok|warn|danger)-(\d+)$/ },
    { pattern: /^(border|bg|text|ring|shadow|placeholder)-(ink|brand|surface|ok|warn|danger)-(\d+)\/([\d.]+)$/ },
    { pattern: /^(opacity|backdrop-blur|rounded|shadow)-.+$/ },
  ],
  plugins: [],
} satisfies Config;
