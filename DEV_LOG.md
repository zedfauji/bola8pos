# Development Log

This log tracks phases, decisions, and concrete steps taken so any engineer/agent can resume work quickly.

## Phases

- Phase 1: Backend foundation (local in-memory data)
  - Health endpoint, basic routes for tables, orders, inventory, loyalty, employees
  - KDS endpoints (list pending, complete order)
  - Simple CORS and JSON handling
  - Smoke test script
- Phase 2: Backend validation & structure
  - DTO validation (e.g., Zod)
  - Error handling policy and standardized response format
  - Logging middleware
- Phase 3: Persistence & Offline-ready backend
  - Move from in-memory to Firestore (Google Cloud)
  - Config via `.env` (service credentials via Secret Manager in cloud)
  - Basic repositories/services
- Phase 4: Auth & RBAC
  - Auth endpoints, JWT, roles (cashier, manager, kitchen)
  - Audit trails
- Phase 5: Core domain features
  - Tables: timers, first 10 min free logic, alarms (server events)
  - Orders: split, tabs, send-to-kitchen routing
  - Inventory: real-time decrements, low-stock alerts
- Phase 6: Realtime & KDS
  - Socket.IO events (order created, prioritized, completed)
  - Kitchen display subscriptions
- Phase 7: Loyalty & Promotions
  - Points accrual/redemption, targeted campaigns
- Phase 8: Reporting & Analytics
  - Sales, inventory, employee performance dashboards
- Phase 9: Employee Management
  - Scheduling, payroll exports, performance metrics
- Phase 10: Frontend UI implementation in phases mirroring backend
  - Tables, Orders, KDS, Inventory, Loyalty, Employees
  - Offline caching (IndexedDB + SW), sync status

## 2025-08-09
- Setup: Cloned repo `zedfauji/bola8pos-ai` into workspace.
- Backend (Phase 1) implemented minimal endpoints in `pos/backend`.
- Frontend scaffolding additions for offline.
- Smoke test added and run.
- Phase 2: Added logging, centralized error handler, Zod validation for orders.
- GCP deploy scaffolding and script added; deployed to Cloud Run.
- Cloud Run URL: https://pos-backend-23sbzjsxaq-uc.a.run.app
- Frontend API default set to Cloud Run in `pos/frontend/src/services/api.ts` (`VITE_API_URL` can override).
- Next: Extend validation to all routes; begin Firestore persistence.
