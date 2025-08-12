## 2025-08-11 — Dev Infra: Fixed Ports & Startup Automation

- Fixed ports for local dev with auto-terminate of conflicting processes.
  - Backend runs on `PORT=3001`; frontend on `5173`.
  - Added Windows-safe port cleanup using `kill-port` in npm pre-scripts.
    - Backend `pos/backend/package.json` scripts:
      - `predev`/`prestart`: kill port 3001 via Node one-liner requiring `kill-port`.
      - `dev`/`start`: `cross-env PORT=3001 node src/server.js`.
      - Dev deps: `cross-env`, `kill-port`.
    - Frontend `pos/frontend/package.json` scripts:
      - `predev`/`prepreview`: kill port 5173 via Node one-liner requiring `kill-port`.
      - `dev`: `vite --port 5173`; `preview`: `vite preview --port 5173`.
      - Dev deps: `kill-port` (and `cross-env` for parity).
  - Frontend env file `pos/frontend/.env.development` sets:
    - `VITE_PORT=5173`, `VITE_API_URL=http://localhost:3001`.
  - PowerShell helper `pos/scripts/ensure-ports.ps1`:
    - Kills processes on 3001 and 5173 (falls back to taskkill), then launches both servers with correct env.
    - Writes logs to `%TEMP%/pos-backend.out/.err` and `%TEMP%/pos-frontend.out/.err`.

Files: `pos/backend/package.json`, `pos/frontend/package.json`, `pos/frontend/.env.development`, `pos/scripts/ensure-ports.ps1`.

---

## 2025-08-11

- Inventory schema bootstrapped on server startup and added mapping for sales-to-stock:
  - Added `menu_item_product_map` to link `menu_items` → `products`/`variants` with `qty_per_item`.
  - Initialized bar inventory schema during backend startup (`server.js` calls `initBarInventorySchema()` from `db_bar_inventory.js`).
  - Implemented stock decrement when paying a bill: `applyInventoryForTable()` aggregates open-order quantities for a table, decrements `inventory`, and logs `inventory_transactions` with `transaction_type='sale'`. Hooked into `POST /api/bills/pay-by-table` before order completion.
  - Files: `backend/src/db_bar_inventory.js`, `backend/src/server.js`.
  - Mounted inventory API namespace and exposed mapping CRUD endpoints:
    - Mounted `app.use('/api/inventory', require('./routes/inventory'))` in `backend/src/server.js`.
    - Endpoints:
      - `GET /api/inventory/map` (list; filter by `menu_item_id`)
      - `POST /api/inventory/map` (create/update mapping)
      - `DELETE /api/inventory/map/:id` (remove mapping)
    - Files: `backend/src/routes/inventory/index.js`, `backend/src/routes/inventory/inventory.routes.js`, `backend/src/middleware/auth.js`, `backend/src/middleware/validate.js`.
  - Purchase Order receive flow updates:
  - `POST /api/inventory/purchase-orders/:id/receive` now updates `inventory` at the target `location_id` and inserts `inventory_transactions` with `transaction_type='purchase'` including `unit_cost`.
  - Updates `products.cost_price` to last received `unit_cost` when provided.
  - File: `backend/src/controllers/inventory/purchase-order.controller.js`.

- Frontend — Low Stock Badge (Inventory)
  - Added `LowStockBadge` component to display live count from backend low-stock endpoint.
  - Component: `pos/frontend/src/components/inventory/LowStockBadge.tsx`
  - Integrated in Inventory header: `pos/frontend/src/routes/Inventory.tsx`
  - Endpoint: `GET /api/inventory/inventory/low-stock?threshold=10`

- Frontend — API base URL fix for Inventory services
  - `pos/frontend/src/services/inventoryService.js` now resolves API base as:
    - `import.meta.env.VITE_API_URL` → `window.__API_BASE_URL__` → default `http://localhost:3001/api`
    - Ensures `/api` suffix when missing.

- Frontend — Low Stock everywhere + navigation + alerts
  - `LowStockBadge` enhancements: clickable navigation (`to`), polling (`pollMs`), and notify on increases (`notifyOnIncrease`).
  - Inventory page: badge now clickable and adds low-only filter via `?low=1`; added “Limpiar filtro” button.
    - File: `pos/frontend/src/routes/Inventory.tsx`
  - Products page: badge added to header next to Add Product; navigates to Inventory low-stock view.
    - File: `pos/frontend/src/pages/inventory/products/ProductsPage.jsx`
  - Bar Sales page: badge added to top bar with polling and increase notifications; navigates to Inventory low-stock view.
    - File: `pos/frontend/src/pages/inventory/sales/BarSalesPage.jsx`
  - Enabled polling on Products badge for real-time updates.
    - File: `pos/frontend/src/pages/inventory/products/ProductsPage.jsx`

- Frontend — Accessibility fix for PIN dialogs
  - Wrapped password/PIN inputs inside `<form>` elements with onSubmit handlers and proper button types.
    - Files:
      - `pos/frontend/src/components/SimpleComponents.jsx`
      - `pos/frontend/src/components/tables/TablesPage.new.jsx`
      - `pos/frontend/src/components/kds/KitchenDisplay.new.jsx`
      - `pos/frontend/src/components/orders/OrderPage.new.jsx`
  - Removes console warning: "Password field is not contained in a form" and improves keyboard submission.
## 2025-08-10

- Tables → Orders navigation wired
  - From `TablesPage` cards, “View Orders/Manage Orders” navigates to `/orders/:tableId`.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- OrderPage UI/UX enhancements
  - Elegant dark theme, table context in header via `useParams`.
  - Quantity controls (−/+) and remove per cart line, smart add-to-cart.
  - Disabled actions when cart empty, improved totals styling.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- TablesPage: Status modal per table
  - New “ℹ️ Status” button on each table card.
  - Modal shows: time logged, items consumed, combo applied, and orders in process.
  - Includes seeded pseudo-random demo data until backend integration.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Finalize Bill (Pre-Payment) flow
  - New “🧾 Finalize Bill” button on each table card.
  - Opens a pre-payment modal with receipt preview (table, session, time charge, subtotal, tax, total).
  - Allows printing the pre-bill and proceeding to the payment screen for the table.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- PaymentPage actions for finalizing
  - Shows table context in header; elegant dark theme.
  - Print Pre-Bill from Payment screen.
  - Cash/Card selection and Process Payment action sets paid state.
  - “Close Bill & Free Table” enabled only after payment; returns to Tables.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Discounts system (frontend)
  - Manage Discounts modal: create/delete discounts saved to localStorage.
  - Support percent/fixed amounts scoped to: Items, Billiard Time, or Total Bill.
  - Apply multiple discounts via checklist; receipt shows discount lines and recomputed totals (tax after discounts).
  - Payment page pre-bill printing includes discounts.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

## 2025-08-11

- Frontend refactor — split large component file
  - Extracted `PaymentPage` from `pos/frontend/src/components/SimpleComponents.jsx` to `pos/frontend/src/components/payment/PaymentPage.jsx`.
  - Moved table ID mapping helper to `pos/frontend/src/components/shared/tableMap.js` and updated imports.
  - Updated router imports in `pos/frontend/src/App.jsx` to use the new `PaymentPage` module.
  - Added temporary re-export shims:
    - `pos/frontend/src/components/tables/TablesPage.jsx` re-exports `TablesPage` from `../SimpleComponents`.
    - `pos/frontend/src/components/orders/OrderPage.jsx` re-exports `OrderPage` from `../SimpleComponents`.
    - `pos/frontend/src/components/kds/KitchenDisplay.jsx` re-exports `KitchenDisplay` from `../SimpleComponents`.
  - Updated `pos/frontend/src/App.jsx` to import `TablesPage`, `OrderPage`, and `KitchenDisplay` from their new module paths.
  - Goal: progressively reduce `SimpleComponents.jsx` size and improve maintainability.

- Refactor — extract full implementations and remove duplicates
  - Extracted full `OrderPage` implementation to `pos/frontend/src/components/orders/OrderPage.jsx` (replacing prior shim).
  - Extracted full `KitchenDisplay` implementation to `pos/frontend/src/components/kds/KitchenDisplay.jsx` (replacing prior shim).
  - Removed both `OrderPage` and `KitchenDisplay` implementations from `pos/frontend/src/components/SimpleComponents.jsx` to eliminate duplication.
  - Verified clean frontend production build after refactor (`npm run build`).
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`, `pos/frontend/src/components/orders/OrderPage.jsx`, `pos/frontend/src/components/kds/KitchenDisplay.jsx`, `pos/frontend/src/App.jsx`.

- Manager approvals + Audit trail (MVP)
  - Backend: added SQLite `audit_logs` table and helper writer.
  - Endpoints:
    - `POST /api/admin/verify-pin` (demo validation vs accessCode/1234)
    - `GET /api/admin/audit?limit=100` (list recent audit logs)
    - `POST /api/orders/void-line` (requires valid managerPin; writes audit)
    - `POST /api/orders/comp-line` (requires valid managerPin; writes audit)
  - Frontend API: methods `verifyManagerPin`, `voidOrderLine`, `compOrderLine`, `getAuditLogs` in `pos/frontend/src/services/api.js`.
  - OrderPage: manager modal now verifies PIN and calls void/comp endpoints; audit entries created. File: `pos/frontend/src/components/orders/OrderPage.jsx`.
  - Admin UI: added read-only `AuditLog` page at `/admin/audit` to view recent entries. Files: `pos/frontend/src/components/admin/AuditLog.jsx`, `pos/frontend/src/App.jsx`.
  - Verified frontend build passes after changes (`npm run build`).

- KDS-lite modal (frontend)
  - Added KDS modal accessible from Tables header. Lists pending tickets from `/api/orders/kds`.
  - Actions per ticket: In Progress (`POST /api/orders/:id/status`), Done (same), Recall (`POST /api/orders/:id/recall`).
  - Access Code input persists to localStorage and auto-injects on all writes.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Table actions persistence (frontend → backend)
  - Transfer: calls `POST /api/tables/:id/migrate` (best-effort). Requires UI→backend table ID mapping via `localStorage('pos_table_map')` (e.g., `{ "B1":1, "B2":2, "T1":13 }`).
  - Merge/Split: emits idempotent events to `POST /api/moves/move` for backend processors. UI updates optimistically regardless of backend availability.
  - Files: `pos/frontend/src/services/api.js`, `pos/frontend/src/components/SimpleComponents.jsx`

- Unified Add to Table action
  - Replaced separate “Send to Kitchen” and “Add to Bill” with a single “Add to Table” button.
  - Auto-routes items based on category to their station: food/combos → kitchen, beers/cocktails → bar.
  - Posts to backend `/api/orders` with `{ table_id, items: [{ id, quantity, price, customizations, prep_time, station }], notes, priority }`.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Access code auto-injection
  - Automatically includes `accessCode` in all mutating API requests (POST/PUT/PATCH/DELETE) from `localStorage('pos_access_code')`, defaulting to `1234`.
  - Helper exported: `setAccessCode(code)` from `pos/frontend/src/services/api.js`.
  - File: `pos/frontend/src/services/api.js`

- Fix — Finalize/Pre-Bill modal JSX
  - Closed the unclosed "Proceed to Payment" button and removed a stray Store Receipt Settings block that was accidentally injected into the Finalize modal.
  - Resolved build-time JSX syntax errors around `SimpleComponents.jsx` lines ~856–902.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Manager approval on Tables (Finalize/End) + Audit
  - Backend: added endpoints `POST /api/tables/:id/finalize-bill` and `POST /api/tables/:id/end-session` requiring `managerPin`; both write audit via `writeAudit()`.
  - Frontend: Tables page now shows a Manager Approval modal (Reason + PIN) for “🧾 Finalize Bill” and “⏹ End Session”. On approve, calls the new endpoints; Finalize then opens Pre-Bill modal.
  - Files: `pos/backend/src/server.js`, `pos/frontend/src/services/api.js`, `pos/frontend/src/components/SimpleComponents.jsx`.

- Tables loaded from backend (persistence)
  - Removed demo/random seeding on Tables page. Now fetches from `/api/tables` and maps fields, so state is consistent across refresh.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Backend — table lifecycle endpoints
  - Added: `POST /api/tables/:id/start`, `POST /api/tables/:id/pause`, `POST /api/tables/:id/resume`, `POST /api/tables/:id/cleaning`.
  - Each writes an audit entry (`start-session`, `pause-session`, `resume-session`, `cleaning-set`).
  - Lightweight migration adds columns if missing: `cleaning_until`, `paused`, `limit_end`.
  - File: `pos/backend/src/server.js`

- Frontend — Start Session wired to backend
  - Start modal now calls `api.startTable()` with rate/limited/minutes/services and reloads tables from backend.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`
  - API client updated with `startTable`, `pauseTable`, `resumeTable`, `setCleaning`.
  - File: `pos/frontend/src/services/api.js`

- Frontend — Pause/Resume/Cleaning wired to backend
  - Tables page now calls lifecycle endpoints and refreshes state from `/api/tables` so UI reflects persisted `paused`, `cleaning_until`, and `limit_end`.
  - Replaced local-only toggles with API calls: `api.pauseTable(id)`, `api.resumeTable(id)`, `api.setCleaning(id, minutes)`.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Backend — CLI port flags parsing
  - `pos/backend/src/server.js` now accepts `--port 3002`, `-p 3002`, `--port=3002`, or a bare positional number to set the port. Falls back to `process.env.PORT` then `3001`.
  - File: `pos/backend/src/server.js`

- Start Game modal (TablesPage)
  - New modal to start a session with tariff selection: name and $/hr rate.
  - Supports Unlimited or Limited time mode (minutes input). Stores `hourlyRate`, `limitEnd`, and `startMeta` on the table.
  - Includes Services editor to add service line items (name + price). Sums into `servicesTotal`.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Cleaning Mode
  - For available tables, added "🧽 Cleaning" action to toggle a 5-minute cleaning window (`cleaningUntil`).
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Finalize calculation includes services
  - `computeFinalize()` now includes `servicesTotal` in `subtotal` and returns a `services` line.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`

- Phase 0 — Receipt settings and print polish
  - Added Store Receipt Settings modal on Payment page to edit/persist store name, address/header, and footer using `localStorage` (`pos_store_config`).
  - Pre-bill receipts in both Finalize modal and Payment page now use these settings for header/footer.
  - Unified print CSS for receipts with a `.receipt` wrapper and proper 58mm/80mm width handling; resets Tailwind backgrounds/colors for clean thermal output.
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Services shown in receipts and totals
  - Finalize Bill receipt shows “Services” line when present.
  - Payment receipt shows “Services” and includes `servicesCharge` in base subtotal and pending bill list total.
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Cleaning badge with countdown
  - Visible 🧽 Cleaning badge with mm:ss countdown on table cards while cleaning window is active (`cleaningUntil`).
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Phase 1 kickoff — Limited-time countdown
  - Added ⏱ Limited Time badge with live mm:ss countdown on occupied tables when `limitEnd` is set; shows ⏰ Time Up after expiry.
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Phase 1 — Operator table/session flows
  - Pause/Resume session: toggles `isPaused`, preserves remaining time (`limitRemaining`), restores `limitEnd` on resume.
  - Transfer session: move session state to an available table.
  - Merge sessions: combine services totals; keep later time expiry; track `mergedFrom` in metadata.
  - Split session: duplicate time state to an available table and split services equally (demo behavior).
  - Table notes: add/edit note per table; rendered on card.
  - Expired time visual alert: card border glows red when limited time is up.
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Phase 2 kickoff — Menu and Orders foundation
  - Added menu item modifiers (single/multi) with a customization modal.
  - Calculated unit price from base price + modifier deltas; stored on cart line.
  - Implemented demo combo logic: $1 off per Beer + Fries pair.
  - Updated Order Summary: shows Subtotal, Combo Discount, and Total.
  - Hooked up actions with demo handlers: Send to Kitchen, Add to Bill.
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Fix — Send to Kitchen endpoint/payload
  - Updated `OrderPage` handler to post to backend `/api/orders` with `{ table_id, items, notes, priority }` as implemented in `pos/backend/src/server.js`.
  - Removed calls to non-existent `/api/orders/route` and station-splitting for now (can be added later once backend routing exists).
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`, `pos/backend/src/server.js`

- Frontend infra — API base URL
  - Switched to Vite-compatible `import.meta.env.VITE_API_URL` with safe window override and localhost fallback.
  - File: `pos/frontend/src/services/api.js`

Notes:
- These are front-end features; data is currently mocked where backend integration isn’t wired yet. Replace with real API calls when ready.

- Reporting basics (backend + frontend)
  - Backend: Added `GET /api/reports/shift?from&to` and `GET /api/reports/today` aggregating orders, bills, and audit void/comp counts by window.
  - Frontend: New Reports page at `/reports` with date-time range filters, run report, and CSV export.
  - Files: `pos/backend/src/server.js`, `pos/frontend/src/components/reports/ReportsPage.jsx`, `pos/frontend/src/services/api.js`, `pos/frontend/src/App.jsx`

- Reports enhancements
  - Backend: extended both endpoints with:
    - Payment method breakdown (`payments_by_method` from `bills.payment_method`).
    - Station throughput (`station_throughput`) using menu `category` → `kitchen`/`bar` mapping.
    - Hourly buckets (`buckets`) for orders vs bills totals with SQLite-friendly UNION join.
  - Frontend: Reports page renders new cards/sections and simple SVG line chart for hourly trend; CSV export includes all new sections.
  - Files: `pos/backend/src/server.js`, `pos/frontend/src/components/reports/ReportsPage.jsx`

- Cashier/Payment polish (MVP)
  - Backend: Added `GET /api/bills/pending` and `POST /api/bills/pay-by-table` to list unpaid bills by table, create a bill, mark orders completed, free the table, and write audit log.
  - Enhanced: `/api/bills/pending` now joins `tables` to compute `timeCharge` from `hourly_rate` and elapsed time (capped at `limit_end` if set), and `servicesCharge` from `current_bill`. `limitEnd` returned for accurate countdown badges.
  - Frontend: `PaymentPage` now loads real pending bills from backend and processes payment via `payByTable` (discount + tip included). Added “Print Final Receipt.”
  - API client: added `getPendingBills()` and `payByTable()`.

- Receipt format polish
  - Implemented a dedicated itemized receipt builder used for both Pre-Bill and Final Receipt.
  - Header metadata: store name, address, optional phone and Tax ID, table, localized date/time, cashier name, and bill ID when available.
  - Currency formatting with configurable symbol and dynamic tax label; supports both 58mm and 80mm widths with clean thermal CSS.
  - Final receipt includes payment method (SPLIT aware), tendered (cash/card), and change due.
  - Frontend stores the `bill_id` and totals returned from `POST /api/bills/pay-by-table` and injects into the printed receipt header.
  - Split tender validation: disables Process until cash+card >= total and shows alert if insufficient; change due computed and printed.
  - Files: `pos/frontend/src/components/payment/PaymentPage.jsx`, `pos/backend/src/server.js` (response shape), `pos/frontend/src/services/api.js`.
  - Files: `pos/backend/src/server.js`, `pos/frontend/src/components/payment/PaymentPage.jsx`, `pos/frontend/src/services/api.js`

## 2025-08-11 — Next Improvements Implemented

- PaymentPage cashier and localization polish
  - Cashier selection/input field added with persistence to `localStorage('pos_cashier_name')`.
  - Currency and date/time localized using `Intl.NumberFormat` and `Intl.DateTimeFormat` from `storeCfg.locale` and `storeCfg.currencyCode` (defaults: en-US, USD).
  - On-screen Pre-Bill now includes Bill/Order number when available.
  - Final printed receipt embeds a QR of `bill_id` for quick lookup.
  - Defaults expanded in store config: `locale`, `currencyCode`; existing `currencySymbol` still supported.
  - Files: `pos/frontend/src/components/payment/PaymentPage.jsx`.

- Global Settings page
  - Added `/settings` page exposing Store Receipt Settings globally: name, address, phone, taxId, currencySymbol, locale, currencyCode, footer.
  - Shows live localized preview and persists to `localStorage('pos_store_config')`.
  - Files: `pos/frontend/src/components/settings/SettingsPage.jsx`, `pos/frontend/src/App.jsx`.

- Discounts (Phase 4 kickoff)
  - Backend: MySQL `discounts` table and CRUD endpoints: `GET/POST/PUT/DELETE /api/discounts`.
  - Seeded examples: `disc10` (10% total), `disc5` (5 fixed total).
  - Frontend: Admin Discounts page (`/admin/discounts`) to list, create, edit, toggle active, delete.
  - Files: `pos/backend/src/db.js`, `pos/backend/src/server.js`, `pos/frontend/src/components/admin/DiscountsPage.jsx`, `pos/frontend/src/App.jsx`.

- Discounts (Phase 4 complete)
  - PaymentPage loads active discounts from backend and applies them to items/time/total.
  - UI shows loading/error/empty states; multiple discounts can be selected.
  - API extended with `getDiscounts()` and `payByTable()` supports optional `member_id` for loyalty hooks.
  - Files: `pos/frontend/src/components/payment/PaymentPage.jsx`, `pos/frontend/src/services/api.js`.

- Store Receipt Settings modal
  - Implemented modal in PaymentPage with editable fields: name, address, phone, taxId, currencySymbol, locale, currencyCode, footer.
  - Live preview shows localized date/time and example currency value.
  - Persists to `localStorage('pos_store_config')`; falls back to en-US/USD when unset.
  - Files: `pos/frontend/src/components/payment/PaymentPage.jsx`.

- Backend billing enhancements
  - Added schema migrations for `bills.tender_cash` and `bills.tender_card` and persisted values on payment.
  - `/api/bills/pay-by-table` now accepts `tender_cash` and `tender_card` and records split payments in audit log and bills table.
  - Files: `pos/backend/src/server.js`

- Orders Summary polish and quick actions
  - Removed VOID/COMP badges from Orders Summary per user request.
  - Added status chips, action to Start/Done, Recall for delivered, manual Refresh, and "Complete all for table" action.
  - Toasts for success/failure; falls back to alert when toast unavailable.
  - Files: `pos/frontend/src/components/orders/OrdersSummary.jsx`

- OrderPage cart cleanup
  - Removed "Void" and "Comp" controls from the right-side Order Summary cart to avoid confusion.
  - Files: `pos/frontend/src/components/orders/OrderPage.new.jsx`

- API client support
  - `payByTable()` now sends `tender_cash` and `tender_card` for split payments (UI hookup pending).
  - Files: `pos/frontend/src/services/api.js`

- Orders Summary filters and station selection
  - Added status filter and table search to Pending.
  - Added status filter and table search to Delivered, with mapping for done/completed.
  - Added station filter (All/Kitchen/Bar) applied to both columns.
  - Files: `pos/frontend/src/components/orders/OrdersSummary.jsx`

- PIN/permission gating for Orders Summary actions
  - Guard Start/Done/Recall/Complete-all with SettingsContext permissions and optional PIN.
  - Files: `pos/frontend/src/components/orders/OrdersSummary.jsx`, `pos/frontend/src/contexts/SettingsContext.jsx`

- Toast notifications provider
  - Dynamically mount `ToastContainer` so `window.toast` works consistently app-wide.
  - Files: `pos/frontend/src/App.jsx`

- Loading skeletons for Orders Summary
  - Shimmer placeholders while fetching data for improved UX.
  - Files: `pos/frontend/src/components/orders/OrdersSummary.jsx`

- KDS-lite live updates
  - Added live polling while KDS modal is open (every 5s) to auto-refresh kitchen/bar queues.
  - Files: `pos/frontend/src/components/SimpleComponents.jsx`

- Reporting enhancements
  - Shift report now returns hourly payment breakdown by method (`payments_by_method_hourly`) and leverages tender columns for accurate method sums.
  - Reports page renders the hourly payment breakdown and includes it in CSV export.
  - Files: `pos/backend/src/server.js`, `pos/frontend/src/components/reports/ReportsPage.jsx`

TODO (next): Wire PaymentPage UI for split tender, change due, and itemized receipt; add polling for pending bills list.

## 2025-08-11 — UI Dark Theme Fixes

- App Layout and Header
  - Switched root layout container to dark theme using `pos-container` and removed light content background to prevent white-on-white.
  - Updated header to `pos-header` with dark borders and readable text colors.
  - File: `pos/frontend/src/App.jsx`.

- Inventory Page Readability
  - Applied dark theme to panels via `pos-card`, inputs via `pos-input`, and actions via `pos-button`/`pos-button-secondary`.
  - Converted table wrapper to `pos-table` and removed light gray header to ensure contrast.
  - Adjusted low-stock highlight to `bg-red-900/20` for dark backgrounds.
  - File: `pos/frontend/src/routes/Inventory.tsx`.

- Audit remaining pages
  - Identified several components still using `bg-white`/light containers (Admin, Reports, Payment, some new variants). Will migrate these to `pos-card`/dark styles next.
  - Files to revisit: `pos/frontend/src/components/admin/*.jsx`, `pos/frontend/src/components/reports/ReportsPage.jsx`, `pos/frontend/src/components/payment/PaymentPage.jsx`, `pos/frontend/src/components/orders/OrderPage.new.jsx`, `pos/frontend/src/components/kds/KitchenDisplay.new.jsx`, `pos/frontend/src/components/tables/TablesPage.new.jsx`.

## 2025-08-11 — Backend MySQL Migration Updates

- MySQL schema and date handling finalized
  - Removed legacy SQLite seeding from `pos/backend/src/server.js`; seeding now happens in `pos/backend/src/db.js:initSchema()` using MySQL `INSERT IGNORE`.
  - Standardized DATETIME usage for `start_time`, `cleaning_until`, and `limit_end` (stored/returned as `YYYY-MM-DD HH:MM:SS`).
  - Fixed `/api/tables/:id/start` and `/api/tables/:id/cleaning` to write MySQL-compatible DATETIME strings.
  - Corrected `/api/bills/pending` time computation to parse `limit_end` via `Date.parse` (DATETIME) instead of epoch integers.

- Reports ported to MySQL
  - `/api/reports/today` now uses DATETIME ranges (`BETWEEN ? AND ?`) and `DATE_FORMAT` for hourly buckets.
  - Replaced SQLite `strftime` usage and ensured station throughput query works on MySQL.
  
## 2025-08-12 — ShiftBar PIN Enforcement & E2E Stability

- Playwright E2E — ShiftBar payout threshold/PIN flows stabilized
  - Fixed API mock routes to match real endpoints: `POST /api/shifts/:id/movement` (singular).
  - Added modal-scoped selectors and waits: ensure `[data-testid="movement-amount"]` is visible before clicking `Add`.
  - Removed duplicate clicks and element-detachment; use `waitForRequest` where appropriate and flag polling elsewhere to avoid races.
  - Print Summary test switched to `page.waitForEvent('popup')` and stubs `window.open().print()` in init script to avoid native dialog hangs.
  - Cleans `localStorage` and sets `window.__E2E__` per test to avoid state bleed.
  - Files: `pos/frontend/tests/e2e/shift.spec.ts`, referenced UI structure in `pos/frontend/src/components/shifts/ShiftBar.jsx`.

- Jest — ShiftBar unit tests remain green after PIN logic refactor
  - `needsPinForPayout()` logic enforced in UI with `isPinRequired()` global requirement, threshold-based override.
  - Files: `pos/frontend/src/components/shifts/pinLogic.js`, `pos/frontend/src/components/shifts/ShiftBar.jsx`.

## 2025-08-12 — Reports: COGS, Top Items, Anomalies

- Backend — Shift Report Enhancements
  - Extended `GET /api/reports/shift` to include:
    - `cogs_total` from `inventory_transactions` with `transaction_type='sale'`.
    - `gross_margin`, `gross_margin_pct` derived from sales minus COGS.
    - `top_items` (name, qty, total) from `order_items`/`menu_items` in window.
    - `top_categories` aggregated by `menu_items.category`.
    - `anomalies` via simple hourly z-score spikes on `bills_total` (z ≥ 2.0).
  - File: `pos/backend/src/server.js` (reports handler around lines ~1080–1176).

- Frontend — Reports UI/CSV
  - `ReportsPage.jsx` now renders:
    - Summary cards for COGS, Gross Margin (value + %).
    - Sections for Top Items, Top Categories, and Anomaly Highlights.
    - CSV export augmented with the above datasets.
  - Files: `pos/frontend/src/components/reports/ReportsPage.jsx`.

- Notes
  - Uses MySQL-friendly `DATE_FORMAT` for hourly buckets and payment breakdown.
  - COGS requires inventory transactions to be recorded on sale; ensure mapping exists for accurate figures.

- Startup logging and dependencies
  - Startup log now prints MySQL pool target: `user@host:port/database` instead of SQLite dbPath.
  - Updated backend dependencies: removed `sqlite3`, added `mysql2`.
  - Files: `pos/backend/src/server.js`, `pos/backend/src/db.js`, `pos/backend/package.json`.

## 2025-08-11 — Phase 5 Admin Settings (Foundations)

- Backend: Admin settings and printing foundations
  - Added MySQL tables: `settings` (key-value JSON), `printer_groups`, `printers`, `print_routes`.
  - Added REST endpoints:
    - Settings: `GET /api/settings/:key`, `PUT /api/settings/:key`.
    - Printer Groups: `GET/POST/PUT/DELETE /api/printer-groups`.
    - Printers: `GET/POST/PUT/DELETE /api/printers`.
    - Print Routes: `GET/POST/PUT/DELETE /api/print-routes`.
  - Seeded printer groups: Kitchen, Barra.
  - Files: `pos/backend/src/db.js`, `pos/backend/src/server.js`.

- Frontend: API client extensions
  - Added methods in `pos/frontend/src/services/api.js` for settings, printer groups, printers, and print routes.

- Frontend: Admin Settings UI
  - New page `/admin/settings` with tabs:
    - General: store/receipt config, tax rate, default hourly, PIN requirement, receipt width; persists to backend `settings.store_config`.
    - Printer Groups: CRUD for groups (enable/disable, delete).
    - Printers: CRUD for printers (driver, connection URL, width, copies).
    - Routing: map menu categories to printer groups.
  - Files: `pos/frontend/src/components/admin/AdminSettings.jsx`, `pos/frontend/src/App.jsx`.

## 2025-08-11 — Admin Settings: Granular Tabs and Keys

- Frontend: Added granular Admin Settings tabs and persistence for:
  - Security & Roles: `auth`, `access_control`, `roles_policy`
  - Taxes & Tips: `taxes`, `tips`
  - Tables & Sessions: `tables`
  - Orders & KDS: `orders`, `kds`
  - Printing & Receipt Layout: `printing`
  - Cash Management: `cash`
  - Reports & Compliance: `reports`, `compliance`
  - Retention & Backups: `retention`, `backups`
  - Notifications & Integrations: `notifications`, `integrations`
  - System/Hardware/PWA: `system`, `hardware`, `pwa`
  - UI & Accessibility: `ui`
  - Files: `pos/frontend/src/components/admin/AdminSettings.jsx`.

Notes:
- These tabs load/save via backend `GET/PUT /api/settings/:key`. Runtime wiring (e.g., enforcing void/refund PIN, applying tax/tip/service charge, KDS polling, receipt copies/width) will be connected next.

## 2025-08-11 — Admin Settings: Grouped Tabs with Subtabs

- Frontend: Refactored Admin Settings to use grouped navigation with subtabs for easier discovery and management.
  - Groups: Store, Security, Sales, Operations, Compliance, System
  - Subtabs reuse existing sections (e.g., `General`, `Security & Roles`, `Taxes & Tips`, `Tables & Sessions`, `Orders & KDS`, `Printing & Receipt`, `Printer Groups`, `Printers`, `Routing`, `Cash Mgmt`, `Reports & Compliance`, `Retention & Backups`, `Notifications & Integrations`, `System/Hardware/PWA`, `UI & Accessibility`).
  - File: `pos/frontend/src/components/admin/AdminSettings.jsx`.

## 2025-08-11 — Runtime Wiring: KDS Settings + PIN Enforcement

- Frontend: KDS settings are now applied at runtime.
  - `kds.pollIntervalMs` controls polling interval in KDS views.
  - Files: `pos/frontend/src/components/kds/KitchenDisplay.jsx`, `pos/frontend/src/components/SimpleComponents.jsx` (KDS modal on Tables page).
- Frontend: Lifecycle PIN enforcement now reads from backend `access_control.requirePinLifecycle` with legacy localStorage fallback.
  - File: `pos/frontend/src/components/SimpleComponents.jsx`.
Notes:
- Next: wire void/comp/refund PINs, apply printing and taxes/tips settings.

## 2025-08-11

### Phase 5 — Admin Settings (Completed)
- **Tariffs & Table Groups**
  - Implemented CRUD for tariffs with time/day restrictions
  - Added table groups (VIP/Hall) with configurable pricing
  - File: `pos/frontend/src/components/admin/AdminSettings.jsx` (TablesSessionsTab)

- **Services Management**
  - Added CRUD for services with name, price, and tax settings
  - Integrated with order and billing system
  - File: `pos/frontend/src/components/admin/AdminSettings.jsx` (ServicesTab)

- **Customers Management**
  - Implemented customer CRUD with discount capabilities
  - Basic structure for future RFID binding
  - File: `pos/frontend/src/components/admin/AdminSettings.jsx` (CustomersTab)

- **Staff & Permissions**
  - Complete staff management with role-based access control
  - PIN enforcement for sensitive operations
  - File: `pos/frontend/src/components/admin/AdminSettings.jsx` (StaffTab)

- **Security & Access Control**
  - PIN verification for admin actions
  - Role-based permissions for all admin functions
  - Audit logging for sensitive operations
  - Files: 
    - `pos/frontend/src/contexts/SettingsContext.jsx`
    - `pos/frontend/src/components/admin/AuditLog.jsx`

- **UI/UX**
  - Tabbed interface for easy navigation
  - Responsive design for all admin functions
  - Real-time validation and feedback

Notes:
- RFID binding is stubbed for future implementation
- Printing execution is not yet wired; this phase focuses on configuration and persistence. Next: use `print_routes` to channel KDS tickets/receipts to group printers.

## 2025-08-11 — Runtime Wiring: Printing + Taxes/Tips in Payment

- Frontend: PaymentPage now loads and applies Admin Settings for printing, taxes, and tips at runtime.
  - Printing (`GET /api/settings/printing`):
    - `receiptWidthMM` → sets default receipt width selector (`58mm`/`80mm`).
    - `copies.final` → prints multiple copies for final receipts.
    - `showQrOnFinal` → toggles QR on final receipt.
  - Taxes (`GET /api/settings/taxes`):
    - `defaultTaxRate` (e.g., 0.08) and `taxMode` (`exclusive`/`inclusive`) are used in totals and receipts.
    - `serviceChargePercent` is added on top of services as an automatic service charge line.
  - Tips (`GET /api/settings/tips`):
    - `suggestedPercents` populate tip buttons.
    - `tipOnPreTax` controls whether tip suggestions compute on pre-tax or post-tax base.
- Files: `pos/frontend/src/components/payment/PaymentPage.jsx`.
- Notes: Totals and printed receipts now reflect admin-configured tax/service charge and tip behavior. Final receipt honors copy count and QR toggle. Pre-bill retains single-print behavior.

## 2025-08-11 — Orders Summary Audit + Realtime

- Backend endpoints audit (Orders/KDS)
  - Verified presence and aligned payloads:
    - `GET /api/orders?kds` replaced by `GET /api/orders/kds` → used by UI
    - `POST /api/orders/:id/status` with `{ status: 'pending'|'in_progress'|'done', accessCode }`
    - `POST /api/orders/:id/recall` with `{ accessCode }`
    - `POST /api/orders/complete-by-table` with `{ table, accessCode }`
    - `GET /api/orders?status=delivered` returns `{ orders: [...] }` with `kitchenStatus: 'done'`
  - Fields used by UI: `id`, `table`, `items`, `kitchenStatus`, `createdAt`.
  - Files: `pos/backend/src/routes/orders.ts`, `pos/backend/src/index.ts` (Socket.IO events).

- Frontend realtime (Socket.IO)
  - Added Socket.IO client singleton.
    - File: `pos/frontend/src/lib/socket.js`.
  - Orders Summary subscribes to `order:created`, `order:status_changed`, `order:completed`, `order:recalled` and refreshes list; polling retained as fallback.
    - File: `pos/frontend/src/components/orders/OrdersSummary.jsx`.
  - Kitchen Display subscribes to same events and updates in place; normalized fields to backend (`kitchenStatus`, `createdAt`, `items[].qty`). Polling retained.
    - File: `pos/frontend/src/components/kds/KitchenDisplay.new.jsx`.

- API alignment
  - Fixed `updateOrderStatus()` to call `POST /api/orders/:id/status` (was PUT /api/orders/:id).
  - Status mapping normalized: UI 'in-progress'/'completed' → backend 'in_progress'/'done'.
  - File: `pos/frontend/src/services/api.js`.

## 2025-08-11 — Dev UX: Port Management and Env Config

- Frontend Vite dev server port is now configurable via `VITE_PORT` (default `5173`). HMR client port follows the same value. No hard-coded ports remain in `vite.config.ts`.
  - File: `pos/frontend/vite.config.ts`
- Added development env file for consistent local settings.
  - File: `pos/frontend/.env.development`
  - Keys: `VITE_PORT=5173`, `VITE_API_URL=http://localhost:3001`
- Created PowerShell helper to free standard ports and start both servers with the correct env.
  - File: `pos/scripts/ensure-ports.ps1`
  - Behavior: kills tasks using ports `3001` (backend) and `5173` (frontend), then starts backend with `PORT=3001` and frontend with `VITE_PORT=5173` and `VITE_API_URL`.
- Backend already honors `PORT` env (falls back to `3001`).
  - File: `pos/backend/src/server.js` (`resolvePort()`)

## 2025-08-12 — Reports: Date Presets + Print-Friendly

- Frontend — Reports usability and printing
  - Added quick date presets: Today, Yesterday, Last 7 Days, Last 30 Days for fast range selection.
  - Added Print button with @media print styles for clean paper output.
    - Hides controls via `.no-print`, prevents card breaks with `.print-card`, flips dark theme to light for paper.
  - Print and CSV export actions reuse RBAC/PIN gating via `checkAccess()` from `SettingsContext`.
  - Minor empty-state polish and disabled states for actions when no data.
  - File: `pos/frontend/src/components/reports/ReportsPage.jsx`.

## 2025-08-12 — Phase 7: Shift UI RBAC/PIN + Modals

- ShiftBar — PIN enforcement and modal UI
  - Replaced prompt-based actions with modal forms for Open, Cash Movements (Drop/Payout/Adjustment), and Close.
  - Enforced RBAC/PIN using `useSettings().isPinRequired()` and `verifyPin()` from `SettingsContext`.
  - Files: `pos/frontend/src/components/shifts/ShiftBar.jsx`, `pos/frontend/src/contexts/SettingsContext.jsx`.

- Printable Shift Summary
  - Added print-friendly summary window for active/closed shift with expected vs counted, over/short, and movement totals.
  - File: `pos/frontend/src/components/shifts/ShiftBar.jsx` (Print action).

- Smoke tests
  - Verified backend shift open/movements/close and summary endpoints via scripts.
  - Files: `pos/backend/scripts/run-shifts-smoke-tests.js`, `pos/backend/scripts/run-shifts-summary-tests.js`.

- ShiftBar UX polish and threshold-aware PIN
  - Added toast notifications on success/failure, loading spinners on Open/Close buttons, and a visible payout threshold hint next to Payout.
  - Wired `SettingsContext.verifyPin()` to real backend endpoint `POST /api/admin/verify-pin` (treats `{ ok: true }` or `{ valid: true }` as success).
  - Enforced threshold-aware PIN for payouts using `settings.access.approvalThresholds.cashPayoutAmount`.
  - Files: `pos/frontend/src/contexts/SettingsContext.jsx`, `pos/frontend/src/components/shifts/ShiftBar.jsx`.

- Backend verification scripts
  - `scripts/run-pin-tests.js`: verifies good PIN accepted and bad PIN rejected.
  - `scripts/run-payout-threshold-tests.js`: updates and reads back `access.approvalThresholds.cashPayoutAmount`.
  - Both executed successfully against local backend on port 3001.
  - Files: `pos/backend/scripts/run-pin-tests.js`, `pos/backend/scripts/run-payout-threshold-tests.js`.

## 2025-08-12 — ShiftBar PIN Tests Stabilized + E2E

- Frontend — ShiftBar Jest tests stabilized
  - Fixed API mock shape and cleared mocks in beforeEach to prevent test pollution.
  - Wrapped async expectations in `waitFor` to avoid timing flakes.
  - Enforced payout threshold PIN via forced `ensurePinIfRequired(action, true)` when `amount >= approvalThresholds.cashPayoutAmount`.
  - Files: `pos/frontend/src/components/shifts/__tests__/ShiftBar.jest.test.jsx`, `pos/frontend/src/components/shifts/ShiftBar.jsx`.

- Frontend — Playwright e2e for ShiftBar
  - Added shift scenarios: payout below threshold (no PIN), payout ≥ threshold (PIN success), invalid PIN blocks, and print summary popup.
  - Tests use network routing to mock backend endpoints and are hermetic.
  - File: `pos/frontend/tests/e2e/shift.spec.ts`.
