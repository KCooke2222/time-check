/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      colors: {
        'intensity-low': '#60A5FA',    // blue
        'intensity-normal': '#34D399', // green
        'intensity-high': '#F87171',   // red
      }
    },
  },
  plugins: [],
}
