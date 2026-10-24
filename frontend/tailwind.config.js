/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Inter', 'sans-serif'],
      },
      colors: {
        // Ledger palette: oat ground, warm ink. Light only.
        oat: '#f3eee4',
        panel: '#fffdf8',
        ink: '#2a2420',
        muted: '#6b6258',
        line: '#e4dccd',
        soft: '#ebe4d6',
        good: '#2f6b4f',
        warn: '#b8603f',
        'intensity-low': '#60A5FA',    // blue
        'intensity-normal': '#34D399', // green
        'intensity-high': '#F87171',   // red
      }
    },
  },
  plugins: [],
}
