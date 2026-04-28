/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0e1a',
          'bg-secondary': '#0d1428',
          'bg-card': 'rgba(13, 20, 40, 0.8)',
          cyan: '#00f0ff',
          purple: '#b400ff',
          green: '#00ff88',
          red: '#ff0040',
          orange: '#ff8800',
          yellow: '#ffcc00',
          'text-primary': '#e0e6f0',
          'text-secondary': '#7a8ba8',
          'border-glow': 'rgba(0, 240, 255, 0.3)',
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'scan-line': 'scanLine 8s linear infinite',
        'neon-pulse': 'neonPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        neonPulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 5px var(--glow-color, #00f0ff)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 20px var(--glow-color, #00f0ff), 0 0 40px var(--glow-color, #00f0ff)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { textShadow: '0 0 5px #00f0ff, 0 0 10px #00f0ff' },
          '100%': { textShadow: '0 0 20px #00f0ff, 0 0 40px #00f0ff, 0 0 60px #00f0ff' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
