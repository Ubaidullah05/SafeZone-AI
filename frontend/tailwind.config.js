/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#070B12',
          900: '#0B111C',
          850: '#0F1726',
          800: '#131D30',
          700: '#1B2740',
          600: '#293755',
        },
        signal: {
          safe: '#2FD180',
          moderate: '#F5B942',
          high: '#F5793A',
          critical: '#F5384C',
          zone: '#3FA8F4',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
