import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./main.tsx",
    "./shared/**/*.{ts,tsx}",
    "./theme-*/*.{ts,tsx}",
    "./theme-*/components/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 24px 80px rgba(15, 23, 42, 0.24)",
      },
    },
  },
  plugins: [],
} satisfies Config;
