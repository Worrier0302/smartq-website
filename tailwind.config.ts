import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        forest: { DEFAULT: "var(--forest)", 2: "var(--forest2)" },
        moss: "var(--moss)",
        sage: "var(--sage)",
        paper: { DEFAULT: "var(--paper)", 2: "var(--paper2)" },
        line: "var(--line)",
        amber: { DEFAULT: "var(--amber)", soft: "var(--amber-soft)" },
        brick: "var(--red)",
        ok: "var(--green-ok)",
        card: "var(--white)",
      },
      fontFamily: {
        sans: [
          "var(--font-archivo)",
          "var(--font-noto-sc)",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
        narrow: ["var(--font-archivo-narrow)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(17,25,23,.04), 0 8px 30px -12px rgba(17,25,23,.25)",
        doc: "0 20px 50px -20px rgba(17,25,23,.35)",
      },
    },
  },
  plugins: [],
};
export default config;
