/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        danger:  { DEFAULT: '#ef4444', light: '#fef2f2', dark: '#991b1b' },
        success: { DEFAULT: '#22c55e', light: '#f0fdf4', dark: '#15803d' },
        warning: { DEFAULT: '#f59e0b', light: '#fffbeb', dark: '#92400e' },
        slate: {
          850: '#172033',
          950: '#0a0f1e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(16px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
      boxShadow: {
        'glow-indigo': '0 0 20px rgba(99,102,241,0.3)',
        'glow-red':    '0 0 20px rgba(239,68,68,0.3)',
        'glow-green':  '0 0 20px rgba(34,197,94,0.3)',
      }
    },
  },
  plugins: [],
}
