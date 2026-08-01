/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0f1117',
        surface: '#1a1d27',
        'surface-hover': '#1e2132',
        overlay: '#13161f',
        edge: '#2a2d3a',
        'edge-hover': '#3a3d4a',
      },
    },
  },
  plugins: [],
}
