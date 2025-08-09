# ProtectedRoute (`src/components/shared/ProtectedRoute.js`)

Summary
Guards routes that require an authenticated user. Redirects to `/login` when `user` is falsy.

Props
- `children: ReactNode` – content to render when authenticated

Usage
```jsx
import ProtectedRoute from '../components/shared/ProtectedRoute';

<Route
  path="/"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

Implementation Notes
- Reads `user` from `AuthContext`.
- Uses `<Navigate to="/login" replace />` for redirects.