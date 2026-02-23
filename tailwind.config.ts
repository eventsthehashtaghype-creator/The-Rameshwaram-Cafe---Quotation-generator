import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 1. YOUR BRAND COLORS (Deep Navy & Royal Blue)
        brand: {
          900: "#0F172A", // Sidebar Background (Deep Navy)
          800: "#1E293B", // Sidebar Hover
          600: "#2563EB", // Primary Buttons (Royal Blue)
          500: "#3B82F6", // Lighter Blue (Focus states)
          50:  "#EFF6FF", // Light Blue Tints
        },
        
        // 2. THE NEUTRALS (Slate - Professional Greys)
        slate: {
          50: "#F8FAFC",  // App Background
          100: "#F1F5F9", // Card Headers
          200: "#E2E8F0", // Borders
          300: "#CBD5E1", // Icons (Inactive)
          400: "#94A3B8", // Muted Text
          500: "#64748B", // Secondary Text
          600: "#475569", // Body Text
          700: "#334155", // High Contrast Text
          800: "#1E293B", // Dark Text
          900: "#0F172A", // Headings
        },

        // 3. STATUS COLORS (Refined Pastel Tones)
        success: { 
          bg: "#ECFDF5",   // Green Background
          text: "#047857"  // Green Text
        },
        warning: { 
          bg: "#FFFBEB",   // Amber Background
          text: "#B45309"  // Amber Text
        },
        danger:  { 
          bg: "#FEF2F2",   // Red Background
          text: "#B91C1C"  // Red Text
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
};
export default config;