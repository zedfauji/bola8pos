# Billiard POS — Phased Delivery Plan

Last updated: 2025-08-11

This plan synthesizes requirements from `billiard_pos_design_document.markdown`, `functionalities1.txt`, and implemented features recorded in `FEATURE_LOG.md`. It enumerates phases, scope, endpoints, UI, data, acceptance criteria, and artifacts.

---

## Phase 0 — Foundation and Infrastructure
- **Scope**
  - Frontend scaffold with React + Vite + Tailwind.
  - API base URL handling: `VITE_API_URL` and `window.__API_BASE_URL__` fallback.
  - Error boundaries, logging, and basic audit hooks.
  - Print styles and receipt layout (58mm/80mm).
- **Artifacts**
  - `pos/frontend/src/services/api.js`
  - `pos/frontend/src/components/SimpleComponents.jsx`
  - `pos/frontend/src/components/payment/PaymentPage.jsx`
  - `pos/backend/src/server.js` (CLI port parsing)
  - `FEATURE_LOG.md`
- **Acceptance**
  - Dev servers start cleanly.
  - Receipts render and print with preset widths.

---

## Phase 1 — Operator Tables and Lifecycle
- **Scope**
  - Persisted tables load from backend.
  - Start session (unlimited/limited + rate + services).
  - Pause/Resume with persisted `paused`.
  - Cleaning timer sets `cleaning_until` (countdown badge).
  - Limited-time countdown badge from backend `limit_end`; "Time Up" when expired.
  - Manager PIN modal for finalize/end; optional PIN for lifecycle via localStorage (`pos_require_pin_lifecycle`).
  - Toast notifications for success/error.
- **Key Endpoints**
  - `POST /api/tables/:id/start` (rate, minutes?, services?)
  - `POST /api/tables/:id/pause`
  - `POST /api/tables/:id/resume`
  - `POST /api/tables/:id/cleaning` (minutes)
  - `GET /api/tables`
- **UI**
  - Tables overview: badges for cleaning and limited-time; expired visual state.
  - Start modal: tariff, unlimited/limited, minutes, services.
- **Artifacts**
  - `pos/frontend/src/components/SimpleComponents.jsx`
  - `pos/frontend/src/services/api.js`
- **Acceptance**
  - Actions persist and reflect on refresh.
  - PIN flow enforced when enabled; toasts replace alerts.

---

## Phase 2 — Orders and KDS (Lite)
- **Scope**
  - Menu with modifiers, customization modal, and combos.
  - Unified "Add to Table" auto-routes items to station (kitchen/bar).
  - KDS-lite: view queues, bump/recall.
- **Key Endpoints**
  - `POST /api/orders` (items with station, notes)
  - `GET /api/kds` (queues), `POST /api/kds/:id/status`
- **UI**
  - Order page with summary (subtotal, combo discounts, total).
  - KDS-lite modal/page for station queues.
- **Artifacts**
  - `pos/frontend/src/components/orders/OrderPage.jsx`
  - `pos/frontend/src/components/kds/KitchenDisplay.jsx`
- **Acceptance**
  - Orders persist and appear in KDS queues; bump/recall works.

---

## Phase 3 — Payment and Receipts
- **Scope**
  - Finalize Bill (pre-bill) modal.
  - Cashier Payment page: list pending bills, process payment, close table.
  - Store Receipt Settings (header/footer), saved locally.
- **Key Endpoints**
  - `POST /api/payments` or `POST /api/tables/:id/close` (as implemented)
  - `GET /api/bills?status=pending`
- **UI**
  - Payment page: select bill, apply discounts/tip, finalize.
  - Printable receipts for 58mm/80mm.
- **Artifacts**
  - `pos/frontend/src/components/payment/PaymentPage.jsx`
- **Acceptance**
  - Bill closes only after payment; tables free and reflect state.

---

## Phase 4 — Discounts and Loyalty (Operator)
- **Scope**
  - Discounts CRUD (percent/fixed; scope: items/time/total).
  - Apply discounts on Payment page with proper receipt reflection.
  - RFID-ready hooks for customer-based discounts/cashback/deposits.
- **Key Endpoints**
  - `GET/POST/PUT/DELETE /api/discounts`
- **UI**
  - Manage discounts UI; apply in payment flow.
- **Acceptance**
  - Discount math correct and auditable; shown on receipts.

---

## Phase 5 — Admin Settings
- **Scope**
  - Tariffs CRUD (per hour, time/day restrictions) and table groups (VIP/Hall).
  - Services CRUD (name, unit, price).
  - Regular Customers CRUD (discounts, RFID binding).
  - Staff CRUD (roles, passwords, RFID).
- **Key Endpoints**
  - `GET/POST/PUT/DELETE /api/tariffs`
  - `GET/POST/PUT/DELETE /api/services`
  - `GET/POST/PUT/DELETE /api/customers`
  - `GET/POST/PUT/DELETE /api/staff`
- **UI**
  - Settings area with sections: Tariffs, Services, Customers, Staff.
- **Acceptance**
  - Start modal pulls tariffs/services from backend; staff/roles enforced.

---

## Phase 6 — Bar Inventory (Optional)
- **Scope**
  - Product groups and products CRUD (name, unit, price).
  - Stock movements: income/expense; optional composite items.
  - Bar Sales screen to add items to bills.
- **Key Endpoints**
  - `GET/POST/PUT/DELETE /api/products`
  - `POST /api/stock/income`, `POST /api/stock/expense`
- **UI**
  - Groups panel + products grid; add items to current table/order.
- **Acceptance**
  - Inventory adjusts with sales and stock operations.

---

## Phase 7 — Reservations (Booking Log)
- **Scope**
  - Calendar-based reservations; table x timeslot grid.
  - Add/edit/delete bookings with comments.
- **Key Endpoints**
  - `GET/POST/PUT/DELETE /api/reservations`
- **UI**
  - Booking Log screen with day view and tap-to-reserve.
- **Acceptance**
  - Conflicts prevented; reservations visible in overview.

---

## Phase 8 — Reporting
- **Scope**
  - Operator quick reports: current/previous shift (sales, discounts, void/comp, station throughput).
  - Admin reports: full reports with export (CSV now; Excel/Word/OpenOffice later).
- **Key Endpoints**
  - `GET /api/reports/shift?from&to`
  - `GET /api/reports/today`
- **UI**
  - Main Report with filters; print/export.
- **Acceptance**
  - Reports reconcile with orders/payments/audit logs.

---

## Phase 9 — Hardware and Real-Time
- **Scope**
  - WebSockets for live updates of tables/orders/KDS.
- **Acceptance**

---

## Phase 10 — Security and RBAC
- **Scope**
  - Operator vs Admin roles; protect admin areas.
  - Manager approvals for critical actions (void/comp/close/price overrides).
  - Comprehensive audit trail across endpoints.
- **Acceptance**
  - Role checks enforced server-side; audit entries present for sensitive ops.

---

## Phase 11 — PWA and Offline
- **Scope**
  - App shell caching; IndexedDB for queued writes (tables/orders/payments).
  - Resync on reconnect with conflict resolution strategy.
- **Acceptance**
  - Core flows usable offline; data converges after reconnect.

---

## Cross-Cutting: Quality and Docs
- **Testing**: smoke tests for endpoints; basic component tests.
- **Docs**: README, onboarding, environment, API reference, printer tips.
- **Feature tracking**: continue updating `FEATURE_LOG.md`.

---

## Immediate Next (from plan.md checklist)
- [ ] Reporting basics (sales, station throughput, void/comp)
- [ ] Ensure limited-time countdown badge always reflects backend `limitEnd`
- [ ] Implement success toasts for lifecycle actions (done for start/pause/resume/cleaning)
- [ ] Implement PIN enforcement copy for lifecycle actions (prompt text); optional policy to default-enable PIN


