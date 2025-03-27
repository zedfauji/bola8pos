/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3B82F6',
          600: '#2563EB',
        },
        secondary: {
          500: '#10B981',
          600: '#059669',
        },
        danger: {
          500: '#EF4444',
          600: '#DC2626',
        }
      }
    },
  },
  plugins: [],
}
