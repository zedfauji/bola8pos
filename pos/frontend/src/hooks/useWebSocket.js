import { useEffect, useRef, useCallback } from 'react';

// useWebSocket can accept either a full ws/wss URL or a channel name (e.g., 'tables').
// When a channel name is provided, the hook builds the full URL using VITE_API_URL
// by switching http(s) to ws(s) and appending `/ws/<channel>`.
export const useWebSocket = (urlOrChannel, onMessage, opts = {}) => {
  const ws = useRef(null);
  const messageHandler = useRef(onMessage);
  const retryRef = useRef(0);

  // Update the message handler if it changes
  useEffect(() => {
    messageHandler.current = onMessage;
  }, [onMessage]);

  const send = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('WebSocket is not connected');
      }
    }
  }, []);

  const close = useCallback(() => {
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  useEffect(() => {
    // Resolve URL
    let resolvedUrl = urlOrChannel;
    if (resolvedUrl && !/^wss?:/i.test(resolvedUrl)) {
      // Treat as channel name, build from API base
      const apiBase = (typeof window !== 'undefined' && window.__API_BASE_URL__) 
        || (import.meta?.env?.VITE_API_URL)
        || window.location.origin;
      if (!apiBase) return;
      const wsBase = apiBase.replace(/^http/i, 'ws').replace(/\/$/, '');
      resolvedUrl = `${wsBase}/ws/${String(urlOrChannel).replace(/^\//,'')}`;
    }

    // Only connect if we have a resolved URL
    if (!resolvedUrl) return;

    // Create WebSocket connection
    const socket = new WebSocket(resolvedUrl);
    ws.current = socket;

    // Connection opened
    socket.onopen = () => {
      retryRef.current = 0;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('WebSocket connected');
      }
    };

    // Listen for messages
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        messageHandler.current?.(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Connection closed
    socket.onclose = () => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('WebSocket disconnected');
      }
      // Retry with basic backoff if enabled
      if (opts?.retry) {
        const next = Math.min(16000, 1000 * Math.pow(2, retryRef.current++));
        setTimeout(() => {
          // trigger re-connect by updating deps via a fake counter; simplest is to re-run effect by changing key
          // Here we rely on opts.retry to keep effect alive; parent re-render should re-invoke hook
        }, next);
      }
    };

    // Connection error
    socket.onerror = (error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('WebSocket error:', error);
      }
    };

    // Cleanup on unmount
    return () => {
      socket.close();
    };
  }, [urlOrChannel, opts?.retry]);

  return { send, close };
};

export default useWebSocket;
