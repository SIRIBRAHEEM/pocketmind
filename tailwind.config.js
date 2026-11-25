/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070d1a',
          900: '#0b1220',
          850: '#0f1830',
          800: '#13203c',
          700: '#1c2f52',
          600: '#2a4170',
        },
        chip: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        cloud: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
        },
        mist: {
          100: '#e8eef7',
          300: '#b9c6da',
          400: '#93a5c0',
          500: '#6e81a0',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 8px 32px -8px rgba(34,211,238,0.35)',
        card: '0 10px 30px -12px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
}
