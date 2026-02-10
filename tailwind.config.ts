import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(40 10% 30%)",
        input: "hsl(40 10% 20%)",
        ring: "hsl(40 90% 60%)",
        background: "hsl(40 25% 7%)",
        foreground: "hsl(40 40% 96%)",
        primary: {
          DEFAULT: "hsl(42 85% 55%)",
          foreground: "hsl(40 25% 10%)"
        },
        secondary: {
          DEFAULT: "hsl(30 18% 15%)",
          foreground: "hsl(40 30% 90%)"
        },
        muted: {
          DEFAULT: "hsl(35 18% 12%)",
          foreground: "hsl(40 20% 70%)"
        },
        accent: {
          DEFAULT: "hsl(48 90% 63%)",
          foreground: "hsl(40 25% 10%)"
        },
        destructive: {
          DEFAULT: "hsl(0 70% 45%)",
          foreground: "hsl(40 40% 96%)"
        },
        card: {
          DEFAULT: "hsl(35 18% 10%)",
          foreground: "hsl(40 40% 96%)"
        }
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem"
      },
      boxShadow: {
        "osrs-panel": "0 0 0 1px hsl(43 35% 35%), 0 6px 0 0 hsl(43 25% 10%)",
        "osrs-button": "0 0 0 1px hsl(43 45% 35%), 0 3px 0 0 hsl(43 25% 8%)"
      },
      fontFamily: {
        runescape: ["'Press Start 2P'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;

