module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        mist: '#f2f4f7',
        stone: '#e5e7eb',
        mint: '#dff5ef',
        sky: '#dfe9ff',
        plum: '#f1e7ff',
        accent: '#2f6fed',
      },
      boxShadow: {
        soft: '0 12px 32px rgba(17, 24, 39, 0.08)',
      },
    },
  },
  plugins: [],
};
