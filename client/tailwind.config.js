/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}