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
        // text placed ON the accent colour (white or black, whichever reads better)
        'on-brass': themeColor('on-brass'),
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
      // Corner style comes from variables (the shop picks sharp / soft / round).
      borderRadius: {
        DEFAULT: 'var(--radius-sm, 0.25rem)',
        md: 'var(--radius-md, 0.375rem)',
        lg: 'var(--radius-lg, 0.5rem)',
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
