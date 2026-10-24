/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#d9e2ff",
          200: "#b9ccff",
          300: "#89adff",
          400: "#5384ff",
          500: "#2b5bf8",
          600: "#183dec",
          700: "#142cc5",
          800: "#15269f",
          900: "#17247d",
        },
        zkPurple: {
          500: "#7928CA",
          600: "#6019A8",
          700: "#490E85",
        },
        darkBg: "#0a0b0e",
        darkCard: "#12141a",
        darkBorder: "#1f232d",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
