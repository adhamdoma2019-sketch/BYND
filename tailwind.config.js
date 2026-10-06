/** @type {import('tailwindcss').Config} */
const themeColor = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: false,
  theme: {
    extend: {
      // Colours are CSS variables (defined in src/index.css) so the whole look
      // can be re-themed in one place: the admin uses the light values, the
      // storefront uses the dark values + the accent colour the shop picked.
      colors: {
        paper: {
          DEFAULT: themeColor('paper'),
          soft: themeColor('paper-soft'),
          dim: themeColor('paper-dim'),
        },
        ink: {
          DEFAULT: themeColor('ink'),
          soft: themeColor('ink-soft'),
          faint: themeColor('ink-faint'),
        },
        // "brass" = the ACCENT colour (name kept so existing screens keep working).
        brass: {
          DEFAULT: themeColor('brass'),
          dark: themeColor('brass-dark'),
          light: themeColor('brass-light'),
        },
        sage: {
          DEFAULT: themeColor('sage'),
          dark: themeColor('sage-dark'),
        },
        rust: {
          DEFAULT: themeColor('rust'),
        },
        // Card / input surface (white in the admin, dark grey in the storefront).
        white: themeColor('white'),
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
