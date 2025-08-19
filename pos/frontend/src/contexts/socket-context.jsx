import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

// Create a context with a default value
const SocketContext = createContext({
  socket: null,
  connected: false,
  sendMessage: (/** @type {string} */ _event, /** @type {any} */ _data) => console.warn('Socket context not initialized')
});

/**
 * Socket provider component
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(/** @type {import('socket.io-client').Socket|null} */ (null));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create socket connection to the backend server
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log('Connecting WebSocket to:', socketUrl);
    
    const socketInstance = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true
    });

    // Set up event listeners
    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Save socket instance
    setSocket(socketInstance);

    // Clean up on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  /**
   * Send a message through the socket
   * @param {string} event - Event name
   * @param {any} data - Data to send
   */
  const sendMessage = (event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot send message');
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
};

/**
 * Hook to use the socket context
 * @returns {{ socket: import('socket.io-client').Socket|null, connected: boolean, sendMessage: (event: string, data: any) => void }} Socket context
 */
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
