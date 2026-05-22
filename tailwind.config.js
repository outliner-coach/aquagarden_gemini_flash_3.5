/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: {
    extend: {
      // 포인트 컬러는 에메랄드 (UI_GUIDE). 한도 임박 시맨틱 색은 HUD step에서 사용.
      colors: {
        usage: {
          ok: '#10b981',
          warn: '#f59e0b',
          danger: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
