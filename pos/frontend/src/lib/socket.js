import { io } from 'socket.io-client';

let socket;

function getApiBase() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch {}
  if (typeof window !== 'undefined' && window.__API_BASE_URL__) return window.__API_BASE_URL__;
  return 'http://localhost:3001';
}

export function getSocket() {
  if (!socket) {
    const base = getApiBase();
    socket = io(base, { transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

export default getSocket();
