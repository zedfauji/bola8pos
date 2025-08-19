// Centralized API base URL resolution for the frontend
// Priority: Vite env (VITE_API_URL) -> window override (__API_BASE_URL__) -> localhost:3001

let API_BASE_URL = 'http://localhost:3001';

try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    API_BASE_URL = import.meta.env.VITE_API_URL;
  }
} catch {}

// @ts-ignore - Custom global property added at runtime
if (typeof window !== 'undefined' && typeof window.__API_BASE_URL__ !== 'undefined') {
  // @ts-ignore - Custom global property added at runtime
  API_BASE_URL = window.__API_BASE_URL__;
}

export { API_BASE_URL };
