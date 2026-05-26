import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
