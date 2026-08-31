/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens
        surface: {
          50: 'var(--surface-50)',
          100: 'var(--surface-100)',
          200: 'var(--surface-200)',
          300: 'var(--surface-300)',
          400: 'var(--surface-400)',
          500: 'var(--surface-500)',
          600: 'var(--surface-600)',
          700: 'var(--surface-700)',
          800: 'var(--surface-800)',
          900: 'var(--surface-900)',
          950: 'var(--surface-950)',
        },
        // Accent colors
        golden: 'var(--golden)',
        'golden-dim': 'var(--golden-dim)',
        // Card / panel colors
        panel: 'var(--panel)',
        'panel-border': 'var(--panel-border)',
        'panel-hover': 'var(--panel-hover)',
        // Text colors
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        // Status colors (same both themes)
        danger: { DEFAULT: '#F43F5E', light: '#FB7185' },
        safe: { DEFAULT: '#34D399', light: '#6EE7B7' },
        amber: { 400: '#FBBF24', 500: '#F59E0B' },
        orange: { 400: '#FB923C', 500: '#F97316' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'glow-v': 'var(--shadow-glow)',
        'glow-g': '0 0 24px rgba(251, 191, 36, 0.2)',
        'glow-r': '0 0 24px rgba(244, 63, 94, 0.25)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'float': 'var(--shadow-float)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-down': 'fadeInDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'tab-change': 'tabChange 0.3s ease-out',
        'notification-in': 'notificationIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'notification-out': 'notificationOut 0.3s ease-in forwards',
        'urgency-pulse': 'urgencyPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeInDown: { '0%': { opacity: '0', transform: 'translateY(-12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(24px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        glowPulse: { '0%, 100%': { boxShadow: '0 0 16px rgba(124,58,237,0.2)' }, '50%': { boxShadow: '0 0 32px rgba(124,58,237,0.4)' } },
        tabChange: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        notificationIn: { '0%': { opacity: '0', transform: 'translateX(100%) scale(0.95)' }, '100%': { opacity: '1', transform: 'translateX(0) scale(1)' } },
        notificationOut: { '0%': { opacity: '1', transform: 'translateX(0) scale(1)' }, '100%': { opacity: '0', transform: 'translateX(100%) scale(0.95)' } },
        urgencyPulse: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
}
