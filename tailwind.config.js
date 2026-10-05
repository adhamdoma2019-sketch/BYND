/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: false,
  theme: {
    extend: {
      colors: {
        // "Workshop" palette — warm stone paper, near-black ink, brass accent.
        // Deliberately avoiding the common cream/terracotta AI-default pairing.
        paper: {
          DEFAULT: '#EDEAE3',
          soft: '#F5F3EE',
          dim: '#E1DCD1',
        },
        ink: {
          DEFAULT: '#20222B',
          soft: '#4A4D57',
          faint: '#8A8D97',
        },
        brass: {
          DEFAULT: '#A8732E',
          dark: '#8A5D24',
          light: '#C79552',
        },
        sage: {
          DEFAULT: '#5F7A63',
          dark: '#48604C',
        },
        rust: {
          DEFAULT: '#9C4A3C',
        },
      },
      fontFamily: {
        // English uses a serif display / sans body split.
        'display-en': ['"Spectral"', 'serif'],
        'body-en': ['"Work Sans"', 'sans-serif'],
        // Arabic uses one carefully-weighted family for both roles.
        'display-ar': ['"IBM Plex Sans Arabic"', 'sans-serif'],
        'body-ar': ['"IBM Plex Sans Arabic"', 'sans-serif'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
      },
    },
  },
  plugins: [],
};
