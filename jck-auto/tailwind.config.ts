import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        surface: "#F8F9FA",
        "surface-alt": "#F1F3F5",
        border: "#E5E7EB",
        primary: {
          DEFAULT: "#1E3A5F",
          hover: "#2A4A73",
        },
        secondary: {
          DEFAULT: "#C9A84C",
          hover: "#D4B85A",
        },
        text: {
          DEFAULT: "#111827",
          muted: "#6B7280",
        },
        china: "#DE2910",
        korea: "#003478",
        japan: "#BC002D",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
