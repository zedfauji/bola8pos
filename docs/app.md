# App and Routing

Entry points:
- `src/index.jsx`: mounts React root and wraps `App` in `AuthProvider`.
- `src/App.jsx`: defines routes and protected sections.

Providers
- `AuthProvider` wraps the app to provide authentication state and helpers.
- `SocketProvider` can wrap parts of the app that need real-time updates.

Protected Routing
The codebase includes a `ProtectedRoute` component at `src/components/shared/ProtectedRoute.js` and an inline example in `App.jsx`. Prefer the shared component.

Example
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Auth/Login';
import AuthProvider from './context/AuthContext';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

Notes
- Ensure `AuthProvider` comes from `src/context/AuthContext.jsx`.
- The inline `ProtectedRoute` shown in `App.jsx` is an example; the shared component ensures consistent behavior.