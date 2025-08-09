// Sample complete structure (compare with yours)
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider, { useAuth } from './context/AuthContext';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Products from './pages/Products';
import Layout from './components/layout';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                {/* Nested routes render here via children */}
              </Layout>
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="tables" element={<Tables />} />
            <Route path="products" element={<Products />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;