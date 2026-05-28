import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Deep ink palette — values driven by CSS vars for light/dark ──
        ink: {
          950: 'rgb(var(--ink-950-rgb) / <alpha-value>)',
          900: 'rgb(var(--ink-900-rgb) / <alpha-value>)',
          800: 'rgb(var(--ink-800-rgb) / <alpha-value>)',
          700: 'rgb(var(--ink-700-rgb) / <alpha-value>)',
          600: 'rgb(var(--ink-600-rgb) / <alpha-value>)',
          500: 'rgb(var(--ink-500-rgb) / <alpha-value>)',
          400: 'rgb(var(--ink-400-rgb) / <alpha-value>)',
          300: 'rgb(var(--ink-300-rgb) / <alpha-value>)',
          200: 'rgb(var(--ink-200-rgb) / <alpha-value>)',
          100: 'rgb(var(--ink-100-rgb) / <alpha-value>)',
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
        // ── surface aliases → ink vars (RGB for opacity modifier support) ─
        surface: {
          900: 'rgb(var(--ink-900-rgb) / <alpha-value>)',
          800: 'rgb(var(--ink-800-rgb) / <alpha-value>)',
          700: 'rgb(var(--ink-700-rgb) / <alpha-value>)',
          600: 'rgb(var(--ink-600-rgb) / <alpha-value>)',
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
