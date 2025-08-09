# Login Page (`src/pages/Auth/Login.jsx`)

Summary
Collects email and 4-digit PIN, calls the auth API, saves the token, and navigates to the dashboard. Displays server errors.

API
- `POST /auth/login` – expects `{ email, pin }` and returns `{ token }`

Usage
```jsx
import Login from '../../pages/Auth/Login';

<Route path="/login" element={<Login />} />
```

Notes
- Stores JWT in `localStorage` under `token`.
- Redirects to `/dashboard` on success.