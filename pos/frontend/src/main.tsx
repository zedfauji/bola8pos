import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Expose backend base URL globally for modules that can't import env directly
// Always use http://localhost:3001 for consistency and to avoid SSL errors
// Note: used by useWebSocket and api.js
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __resolvedBase = 'http://localhost:3001';
// @ts-ignore
window.__API_BASE_URL__ = __resolvedBase;

console.log('API Base URL:', window.__API_BASE_URL__);

// Register service worker for offline functionality (production only)
if (import.meta && import.meta.env && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
