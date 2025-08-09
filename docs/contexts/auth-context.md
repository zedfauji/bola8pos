# Auth Context (`src/context/AuthContext.jsx`)

Summary
Provides authentication state and helpers to log in and log out. Persists JWT in `localStorage` and navigates on auth changes.

Exports
- `AuthContext`: React context
- `default`: `AuthProvider({ children })`

Context Value
- `user: object | null`
- `login(credentials: { email: string; pin: string } | { email: string; password: string }): Promise<void>`
- `logout(): void`

Behavior
- `login` calls `POST /auth/login`, sets `user`, stores `token`, navigates to `/`.
- `logout` clears `user`, removes `token`, navigates to `/login`.

Usage
```jsx
import { useContext, useState } from 'react';
import AuthProvider, { AuthContext } from '../context/AuthContext';

function LoginForm() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    await login({ email, pin });
  }

  return /* form UI */ null;
}

export default function App() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
```

Notes
- If you prefer a hook API, you can create `useAuth = () => useContext(AuthContext)` at the app level and re-export it.