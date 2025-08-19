# API Service (`src/services/api.js`)

Summary
Creates a pre-configured Axios instance for calling the backend API with an automatic `Authorization: Bearer <token>` header when a token exists in `localStorage`.

Base URL
- `import.meta.env.VITE_API_URL` or defaults to `http://localhost:5000/api`

Exports
- `default`: Axios instance

Interceptors
- Request: attaches `Authorization` header if `localStorage.getItem('token')` is present.

Usage
```js
import api from '../services/api';

// GET
const { data: tables } = await api.get('/tables');

// POST (login)
const { data } = await api.post('/auth/login', { email, pin });
localStorage.setItem('token', data.token);

// POST (create order)
await api.post('/orders', { tableId, items: [{ itemId, quantity }] });
```

Environment
- Define `VITE_API_URL` for non-local development.