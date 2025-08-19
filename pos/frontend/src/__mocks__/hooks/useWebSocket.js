// Mock implementation of useWebSocket hook
export const useWebSocket = (url, onMessage) => {
  // Mock WebSocket connection
  const send = (message) => {
    console.log('Mock WebSocket send:', message);
  };

  const close = () => {
    console.log('Mock WebSocket close');
  };

  return { send, close };
};

export default useWebSocket;
