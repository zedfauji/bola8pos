# Billiard POS – Developer Documentation

This documentation covers all public APIs, React contexts, and UI components in the frontend. Each entry includes a summary, props/exports, and usage examples.

- App and Routing
  - See `docs/app.md`
- Services
  - `docs/services/api.md`
  - `docs/services/notify.md`
- Contexts
  - `docs/contexts/auth-context.md`
  - `docs/contexts/socket-context.md`
- Components
  - `docs/components/ProtectedRoute.md`
  - `docs/components/QuickOrder.md`
  - `docs/components/TableCard.md`
  - `docs/components/TableStatus.md`
  - `docs/components/Layout.md`
- Pages
  - `docs/pages/Login.md`
  - `docs/pages/Dashboard.md`
  - `docs/pages/Tables.md`
  - `docs/pages/Products.md`

Conventions
- All paths are relative to `billiard-pos/frontend/src`.
- Environment variables:
  - `VITE_API_URL` (Axios base URL)
  - `REACT_APP_WS_URL` (WebSocket base URL)