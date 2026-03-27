import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0d0d0f',
        panel: '#111114',
        card: '#1a1a1f',
        border: '#2a2a32',
        accent: '#e84545',
        primary: '#f0ece0',
        muted: '#6b6b7a',
      },
      fontFamily: {
        mono: ['var(--font-dm-mono)', 'DM Mono', 'monospace'],
        caveat: ['var(--font-caveat)', 'Caveat', 'cursive'],
      },
    },
  },
  plugins: [],
}

export default config
