import { vi } from 'vitest';
// Mock css.escape before anything else loads
vi.mock('css.escape', () => ({ default: (s: unknown) => String(s) }));
import '@testing-library/jest-dom';

// Basic toast mock so components can call window.toast.success/error
// without blowing up during tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toast: any = {
  success: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
};
// @ts-ignore
if (!window.toast) {
  // @ts-ignore
  window.toast = toast;
}

// Mock window.open used by print receipts to avoid opening real windows
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWin: any = {
  document: {
    write: () => {},
    close: () => {},
  },
  print: () => {},
  focus: () => {},
};
// @ts-ignore
vi.stubGlobal('open', () => mockWin);

// Provide CSS.escape if missing and mock 'css.escape' module if imported
// @ts-ignore
if (!(window as any).CSS || typeof (window as any).CSS.escape !== 'function') {
  // @ts-ignore
  (window as any).CSS = { ...(window as any).CSS, escape: (s: unknown) => String(s) };
}
// Some libs import 'css.escape' package name; already mocked above
