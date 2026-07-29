/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Amarhan brand colors
        amarhan: {
          green: '#00C27A',
          blue: '#4BA3FF',
        },
        primary: {
          DEFAULT: '#00C27A',
          50: '#e6f7f0',
          100: '#cceee1',
          200: '#99ddc3',
          300: '#66cca5',
          400: '#33bb87',
          500: '#00C27A',
          600: '#00a366',
          700: '#007a4d',
          800: '#005233',
          900: '#00291a',
        },
        secondary: {
          DEFAULT: '#4BA3FF',
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99cbff',
          300: '#66b1ff',
          400: '#3397ff',
          500: '#4BA3FF',
          600: '#3c82cc',
          700: '#2d6199',
          800: '#1e4066',
          900: '#0f2033',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', '"Noto Sans"', 'Comfortaa', 'sans-serif'],
        noto: ['"Noto Sans"', 'sans-serif'],
        comfortaa: ['"Comfortaa"', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
    },

  },
  plugins: [],
} 