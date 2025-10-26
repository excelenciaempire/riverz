import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "brand-dark-primary": "var(--brand-dark-primary)",
        "brand-dark-secondary": "var(--brand-dark-secondary)",
        "brand-accent": "var(--brand-accent)",
        "brand-white": "var(--brand-white)",
        "brand-blue": "var(--brand-blue)",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

