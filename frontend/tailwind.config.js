/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    screens: {
      'xs': '375px',   // Small phones (iPhone SE, small Android)
      'sm': '640px',   // Large phones / Small tablets
      'md': '768px',   // Tablets
      'lg': '1024px',  // Laptops
      'xl': '1280px',  // Desktops
      '2xl': '1536px', // Large screens
    },
    extend: {
      colors: {
        // Herbalife-inspired unified theme - Green shades + White
        herbalife: {
          50: '#f4fef1',    // Very light green (almost white)
          100: '#e6fce0',   // Extra light green
          200: '#cef9c1',   // Light green tint
          300: '#a8f089',   // Soft green
          400: '#8ee960',   // Medium-light green
          500: '#79B928',   // Herbalife signature green (primary)
          600: '#6ba024',   // Medium green
          700: '#5a8620',   // Dark green
          800: '#4a6b1a',   // Extra dark green
          900: '#3a5414',   // Deep green
        },
        // Keep green as alias for herbalife for backward compatibility
        green: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        // Override blue, purple, orange with green shades for unified theme
        blue: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        purple: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        orange: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        teal: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        cyan: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        indigo: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        pink: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        },
        emerald: {
          50: '#f4fef1',
          100: '#e6fce0',
          200: '#cef9c1',
          300: '#a8f089',
          400: '#8ee960',
          500: '#79B928',
          600: '#6ba024',
          700: '#5a8620',
          800: '#4a6b1a',
          900: '#3a5414',
        }
      }
    },
  },
  plugins: [],
}
