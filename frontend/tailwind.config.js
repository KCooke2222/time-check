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
        // Ledger palette: oat ground, warm ink; neutral greys in dark mode (index.css).
        oat: 'rgb(var(--oat) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        soft: 'rgb(var(--soft) / <alpha-value>)',
        good: 'rgb(var(--good) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        'intensity-low': '#60A5FA',    // blue
        'intensity-normal': '#34D399', // green
        'intensity-high': '#F87171',   // red
      }
    },
  },
  plugins: [],
}
