/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#100E1B",
        secondary: "#FFFFFF",
        accent: "#3D3C63",
        neutral: "#212036",
        "base-100": "#0B0B1A",
        "border-color": "#3D3C63",
      },
      fontFamily: {
        sans: ['"inter-variable"', "sans-serif"],
      },
      animation: {
        spin: "spin 1s linear infinite",
        "glow-breathe": "glow-breathe 2s ease-in-out infinite",
        "logo-float": "logo-float 2s ease-in-out infinite",
        "sparkle-rotate": "sparkle-rotate 8s linear infinite",
        blob: "blob 7s infinite",
      },
      keyframes: {
        "glow-breathe": {
          "0%, 100%": { transform: "scale(1.1)", opacity: "0.9" } /* Max glow when logo is at bottom */,
          "50%": { transform: "scale(1)", opacity: "0.6" } /* Min glow when logo is at top */,
        },
        "logo-float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" } /* Corrected bounce height */,
        },
        "sparkle-rotate": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "tranlate(0px, 0px) scale(1)",
          },
        },
      },
      animationDelay: {
        2000: "2s",
        4000: "4s",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
