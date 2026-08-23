/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#F0F4FA',
          900: '#FFFFFF',
          850: '#F7F9FC',
          800: '#EEF2F8',
          700: '#DDE4EF',
          600: '#C5D0E4',
        },
        signal: {
          safe: '#16A34A',
          moderate: '#D97706',
          high: '#EA580C',
          critical: '#DC2626',
          zone: '#2563EB',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
