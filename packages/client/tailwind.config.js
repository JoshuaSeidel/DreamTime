/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sleep tracking action colors
        'put-down': '#3b82f6',     // blue-500
        'asleep': '#8b5cf6',       // violet-500
        'awake': '#eab308',        // yellow-500
        'out-of-crib': '#22c55e',  // green-500
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
