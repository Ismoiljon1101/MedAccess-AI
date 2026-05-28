import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
        accent: {
          400: '#4cd3c2',
          500: '#22b8a3',
          600: '#129079',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        },
        warn: {
          500: '#f59e0b',
        },
        ok: {
          500: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 30px -10px rgba(34, 184, 163, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
