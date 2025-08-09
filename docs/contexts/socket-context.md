# Socket Context (`src/context/SocketContext.jsx`)

Summary
Provides a Socket.IO client instance to children for real-time updates (e.g., table status changes).

Exports
- `SocketProvider({ children })`
- `useSocket()`

Configuration
- Connects to `process.env.REACT_APP_WS_URL` or falls back to `http://localhost:5000`.

Usage
```jsx
import { SocketProvider, useSocket } from '../context/SocketContext';

function TablesRealtime() {
  const socket = useSocket();
  useEffect(() => {
    socket.on('table-updated', (payload) => {
      // handle update
    });
    return () => socket.off('table-updated');
  }, [socket]);
  return null;
}

export default function App() {
  return (
    <SocketProvider>
      <TablesRealtime />
    </SocketProvider>
  );
}
```

Notes
- Ensure your backend emits `table-updated` events with the expected payload shape.