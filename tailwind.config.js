/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f4f8",
          100: "#e6e6ee",
          200: "#c9c9d8",
          300: "#a3a3b8",
          400: "#7a7a92",
          500: "#54547a",
          600: "#3a3a5a",
          700: "#2a2a44",
          800: "#1c1c30",
          900: "#10101e",
        },
        gold: {
          50: "#fbf7ed",
          100: "#f5ecd0",
          200: "#ecd9a3",
          300: "#e0c06d",
          400: "#c9a961",
          500: "#b08d3c",
          600: "#9a7631",
          700: "#7a5d27",
          800: "#5e4720",
          900: "#3f3015",
        },
        paper: {
          50: "#fdfbf7",
          100: "#f9f4ea",
          200: "#f0e8d4",
          300: "#e0d4b3",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Crimson Pro"', "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      maxWidth: {
        content: "640px",
        reading: "800px",
      },
    },
  },
  plugins: [],
};
