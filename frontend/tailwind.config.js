/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070b14",
          900: "#0b1120",
          800: "#111a2e",
          700: "#1a2740",
        },
        brand: {
          50: "#eef4ff",
          100: "#dce7fd",
          200: "#c2d5fc",
          300: "#9ab9fa",
          400: "#6c94f5",
          500: "#4a6ef0",
          600: "#3450e0",
          700: "#2b3fce",
          800: "#2936a6",
          900: "#273383",
        },
        teal: {
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
        },
        amber: {
          300: "#fcd34d",
          400: "#fbbf24",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -12px rgba(74, 110, 240, 0.45)",
        card: "0 8px 30px -12px rgba(2, 6, 20, 0.6)",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.55 },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
        scan: "scan 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
