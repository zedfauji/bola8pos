module.exports = {
  // Limit ESLint to app source; root configs / .storybook / supabase functions use other tsconfigs.
  'src/**/*.{ts,tsx}': ['eslint --fix --max-warnings 0', 'prettier --write'],
  '*.{json,md,css}': ['prettier --write'],
};
