/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["Lora", "serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      colors: {
        // Guest surface — warm cream theme
        guest: {
          bg: "#F5F0E6",
          panel: "#FBF6EC",
          panel2: "#EFE7D8",
          border: "#E4D9C3",
          borderAlt: "#D8CBAE",
          borderDashed: "#B7A072",
          text: "#302B27",
          dim: "#6B5F52",
          faint: "#8A7A63",
          accent: "#A35D3A",
          accentDark: "#8A4A2E",
        },
      },
    },
  },
  plugins: [],
};
