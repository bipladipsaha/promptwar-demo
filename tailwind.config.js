/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "civic-blue": "#0a2540",
        "civic-emerald": "#059669",
        "civic-emerald-light": "#d1fae5",
        "civic-navy": "#10294a",
        "civic-accent": "#4059aa",
        "civic-gold": "#f59e0b",
        "civic-surface": "#f0f4f8",
        "civic-card": "#ffffff",
        "civic-muted": "#64748b",
        "civic-danger": "#dc2626",
        "civic-success": "#16a34a",
        "civic-warn": "#d97706"
      },
      fontFamily: { 'inter': ['Inter', 'sans-serif'] },
      fontSize: {
        "display": ["42px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "heading": ["24px", { lineHeight: "1.3", fontWeight: "700" }],
        "subheading": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        "caption": ["12px", { lineHeight: "1.3", fontWeight: "600" }]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
