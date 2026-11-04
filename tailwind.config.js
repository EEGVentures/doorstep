/** Brand tokens from brand/01-Brand-Guidelines.md (rebuild edition, 3 Nov 2026). */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1030',
        muted: '#655E6B',
        coral: '#FF5A5F',
        amber: '#FF8A3D',
        action: '#BE3540',
        wash: '#FFF0EB',
        canvas: '#FCFAF8',
        line: '#E6DFDC',
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: { brand: 'linear-gradient(115deg, #FF5A5F 0%, #FF8A3D 100%)' },
      borderRadius: { card: '20px' },
    },
  },
  plugins: [],
};
