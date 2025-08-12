import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/components/shifts/__tests__/rtl-smoke.test.tsx'],
  },
  resolve: {
    alias: [
      { find: 'css.escape', replacement: '/src/shims/css.escape.ts' },
    ],
  },
});
