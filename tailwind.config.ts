import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Commission 127 brand: teal accent and charcoal from c127.org
        brand: { DEFAULT: '#00A499', dark: '#00857C', deep: '#005F59', light: '#EAF6F5', mid: '#BFE5E2' },
        ink: { DEFAULT: '#262626', soft: '#5C5C5C', faint: '#8A8F8E' },
        paper: '#F6F8F8',
        line: '#E2E7E6',
        warn: { DEFAULT: '#C2620A', light: '#FFF3E3' },
        alert: { DEFAULT: '#B3261E', light: '#FDECEA' },
        good: { DEFAULT: '#1E7B4B', light: '#E7F5EC' },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
