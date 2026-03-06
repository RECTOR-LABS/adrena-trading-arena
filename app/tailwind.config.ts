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
        arena: {
          dark: '#0a0a1a',
          card: '#111127',
          border: '#1e1e3a',
          accent: '#e94560',
          blue: '#0f3460',
          deep: '#16213e',
          text: '#e0e0e0',
          muted: '#6b7280',
          success: '#10b981',
          warning: '#f59e0b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
