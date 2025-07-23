/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ChatGPT-inspired Dark Theme
        dark: {
          bg: '#1e1e1e',
          'bg-secondary': '#2a2a2a',
          card: '#363636',
          border: '#3a3a3a',
          'border-hover': '#4a4a4a',
        },
        accent: {
          primary: '#10a37f',
          secondary: '#00b2ff',
          'primary-hover': '#0d8a6b',
          'primary-light': '#10a37f20',
        },
        text: {
          primary: '#ffffff',
          secondary: '#d1d5db',
          muted: '#9ca3af',
          disabled: '#6b7280',
        },
        // Legacy Shopify colors (keep for compatibility)
        shopify: {
          50: '#f7fafb',
          100: '#f1f5f8',
          200: '#dfe7ed',
          300: '#c4d1db',
          400: '#97afc2',
          500: '#6b8aab',
          600: '#546e8e',
          700: '#475770',
          800: '#3a4555',
          900: '#2e3641',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(16, 163, 127, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(16, 163, 127, 0.6)' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}