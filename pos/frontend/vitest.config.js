import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Only include our minimal test file
    include: ['src/__tests__/minimal.test.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.cache/**',
      '**/temp/**'
    ]
  },
});
