import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#e30613",
        "on-primary": "#ffffff",
        "primary-container": "#e30613",
        "on-primary-container": "#fff5f3",
        secondary: "#5d5f5f",
        "secondary-container": "#dfe0e0",
        tertiary: "#0059a8",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        surface: "#f8f8f8",
        "surface-dim": "#dcd9d9",
        "surface-bright": "#fbf9f8",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f3f2",
        "surface-container": "#f0eded",
        "surface-container-high": "#eae8e7",
        "surface-container-highest": "#e4e2e1",
        "on-surface": "#1b1c1c",
        "on-surface-variant": "#5e3f3b",
        outline: "#936e69",
        "outline-variant": "#e9bcb6",
        background: "#ffffff",
      },
      borderRadius: { DEFAULT: "0.125rem", lg: "0.25rem", xl: "0.5rem", full: "0.75rem" },
      spacing: {
        xs: "4px", sm: "12px", md: "24px", lg: "40px", xl: "64px",
        gutter: "24px", margin: "32px", "margin-desktop": "64px", "margin-mobile": "16px", unit: "8px",
      },
      fontFamily: { sans: ["DM Sans", "sans-serif"] },
      fontSize: {
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "700" }],
        "label-sm": ["10px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "700" }],
        "title-lg": ["20px", { lineHeight: "28px", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};
export default config;