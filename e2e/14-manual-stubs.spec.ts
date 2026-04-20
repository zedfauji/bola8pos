import { test } from '@playwright/test';

test.describe('Manual verification stubs (7-day plan)', () => {
  test('Day 1 — Tauri window + physical PIN + Supabase console', () => {
    test.skip(
      true,
      'Manual: Run `npm run tauri dev`. Verify native window opens, physical PIN keypad works, and Supabase shows no connection errors in devtools.'
    );
  });

  test('Day 2 — Storybook at localhost:6006 without console errors', () => {
    test.skip(
      true,
      'Manual: Run `npm run storybook`, open http://localhost:6006, watch browser console for errors while clicking key stories.'
    );
  });

  test('Day 2 — Zustand store spot-check beyond automated unit run', () => {
    test.skip(
      true,
      'Manual: `npm run test` is covered in CI Checks; additionally run targeted store scenarios in dev if you change state logic.'
    );
  });

  test('Day 7 — Tauri production build (duplicate of automated opt-in)', () => {
    test.skip(
      true,
      'Manual: Run `npm run tauri build` from repo; confirm exit 0 and MSI under src-tauri/target/release/bundle/msi/. Automated variant: e2e/13-tauri-build.spec.ts with RUN_TAURI_E2E=1.'
    );
  });
});
