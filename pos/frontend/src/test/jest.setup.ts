import '@testing-library/jest-dom';

// Mock css.escape globally for libs that import it or use CSS.escape
if (typeof (global as any).CSS === 'undefined') {
  (global as any).CSS = {} as any;
}
(global as any).CSS.escape = (s: unknown) => String(s);

jest.mock('css.escape', () => ({
  __esModule: true,
  default: (s: unknown) => String(s),
}));

// Polyfills commonly required by MUI/RTL under Jest
import { TextEncoder, TextDecoder } from 'util';
// @ts-ignore
if (!(global as any).TextEncoder) (global as any).TextEncoder = TextEncoder;
// @ts-ignore
if (!(global as any).TextDecoder) (global as any).TextDecoder = TextDecoder as any;

// matchMedia polyfill
if (!('matchMedia' in window)) {
  // @ts-ignore
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// createRange polyfill
if (!document.createRange) {
  // @ts-ignore
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document,
    createContextualFragment: (html: string) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    },
  });
}

// ResizeObserver polyfill
if (!(global as any).ResizeObserver) {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// IntersectionObserver polyfill
if (!(global as any).IntersectionObserver) {
  (global as any).IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as any;
}

// Window shims
Object.defineProperty(window, 'open', {
  writable: true,
  value: () => ({ document: { write() {}, close() {} }, print() {} }),
});

// Misc browser shims
// @ts-ignore
if (typeof window.scrollTo !== 'function') window.scrollTo = () => {};
// @ts-ignore
if (!(global as any).requestAnimationFrame) (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
// @ts-ignore
if (!(global as any).cancelAnimationFrame) (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

// Toast shim
(global as any).toast = {
  success: () => {},
  error: () => {},
  info: () => {},
};
