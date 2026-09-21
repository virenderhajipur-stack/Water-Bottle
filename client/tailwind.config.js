/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#daefff',
          200: '#bde4ff',
          300: '#90d4ff',
          400: '#5bbbff',
          500: '#3498ff',
          600: '#1f7bf5',
          700: '#1763e1',
          800: '#1a50b6',
          900: '#1b468f',
          950: '#152c57'
        },
        dark: '#0f172a',
        ink: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          400: '#94a3b8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};