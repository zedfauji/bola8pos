import { AuthProvider } from './context/AuthContext';
import AppRouter from './AppRouter';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
