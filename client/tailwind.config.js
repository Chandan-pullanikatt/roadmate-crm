/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface2)',
        'surface-3': 'var(--surface3)',
        border: 'var(--border)',
        'border-2': 'var(--border2)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        'accent-mid': 'var(--accent-mid)',
        blue: 'var(--blue)',
        'blue-light': 'var(--blue-light)',
        amber: 'var(--amber)',
        'amber-light': 'var(--amber-light)',
        red: 'var(--red)',
        'red-light': 'var(--red-light)',
        purple: 'var(--purple)',
        'purple-light': 'var(--purple-light)',
        teal: 'var(--teal)',
        'teal-light': 'var(--teal-light)',
        orange: 'var(--orange)',
        'orange-light': 'var(--orange-light)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
      }
    },
  },
  plugins: [],
}
