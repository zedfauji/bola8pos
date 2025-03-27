import { SocketProvider } from './context/SocketContext';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './AppRouter';

function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </SocketProvider>
  );
}

export default App;
