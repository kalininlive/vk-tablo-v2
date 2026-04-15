/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        field: '#0f172a',
        grass: '#14532d',
        panel: '#111827'
      }
    }
  },
  plugins: []
}
