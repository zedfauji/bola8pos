# Order Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem manages menu items, order placement, customizations, combos, and an enhanced KDS for routing to kitchen/bar, with advanced features like priority handling, feedback loops, and analytics.

## Features
- **Menu CRUD**:
  - **Create Menu Item**: Form with name, price, category, modifiers (multi-select with deltas), station, and images. Validation: Category from predefined list; price tiers (e.g., small/large).
  - **List Menu Items**: Categorized accordion or tabs; filters by category/station/price; search with highlights. Explicit: Drag-and-drop reordering for display priority; availability toggle.
  - **Update Menu Item**: Bulk edits for prices (e.g., inflation adjust all by %); modifier additions with impact preview.
  - **Delete Menu Item**: Check for open orders; alternative suggestion (e.g., "Replace with similar item?").
- **Order Placement**:
  - **Add to Table**: Table selector with current status preview; item grid with images and quick-add buttons. Modifiers modal with checkboxes and notes field.
  - **Cart Management**: Line items with quantity sliders, remove, and real-time subtotal. Explicit: Combo detection popup (e.g., "Add fries for $1 discount?"); allergen warnings based on modifiers.
  - **Send Order**: Priority flags (normal/rush); split by station automatically. Edge case: Hold orders (e.g., "Send later"); timed orders (e.g., "Deliver in 30min").
- **KDS-Lite**:
  - **Queues**: Dual-column view (pending/delivered); filters by station, table, status; search by order ID/notes.
  - **Actions**: Mark in_progress with timer start, done with feedback (e.g., "Order quality rating"), recall with reason. Explicit: Bump all for table; voice alerts for new orders.
  - **Live Updates**: Websockets for instant refreshes; fallback polling; color-coding by age (red for >10min pending).
- **Combos and Promotions**:
  - **CRUD Combos**: Define rules (e.g., item A + B = discount); time-limited promos (e.g., happy hour).
  - **Application**: Auto-apply in cart; manual override. Edge case: Nested combos; conflict resolution if multiple apply.
- **Additional Functionalities**:
  - **Order History**: Per-table archive with reprint option; analytics on popular items.
  - **Feedback Loop**: Post-completion surveys from KDS (e.g., "Customer complaint?"); integrate with performance.
  - **Rush Handling**: Escalation for delayed orders; notifications to manager.
- **Edge Cases**:
  - Void/Comp: Multi-step with reason, PIN, and partial void (single item). Prevent after done status.
  - Offline: Local queuing with sync; merge conflicts (e.g., duplicate orders).
  - Bulk Orders: Group ordering for events; split bills preview.
  - Internationalization: Menu in Spanish/English; currency formatting.
  - Security: Limit voids to authorized roles; log all changes.

## Main Page
Clicking on the Order Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard shows live order queues (KDS view), menu overview (categorized grid), and widgets for pending orders count, average prep time, top items chart. It includes a sidebar for sub-modules (Menu, Orders, KDS, Combos, Analytics), quick table selector for new orders, and customizable layouts (e.g., full-screen KDS for kitchen). The dashboard is responsive, with dark mode, touch-optimized for handhelds, and real-time metrics.

## Endpoints
- `GET /api/menu_items?category={category}&station={station}` (list with filters).
- `POST /api/orders` (create with combos).
- `GET /api/orders/kds?station={station}&status={status}` (queues).
- `POST /api/orders/:id/status` (update with feedback).
- `POST /api/orders/:id/recall` (recall with reason).
- `POST /api/orders/complete-by-table` (bulk complete).
- `GET /api/orders/analytics` (popular items, delays).

## Integrations
- **Inventory Subsystem**: Real-time stock checks on add; decrement on send.
- **Table Management Subsystem**: Pull table status for order context.
- **Access Management Subsystem**: PIN for voids/recalls.
- **Payment Subsystem**: Push sent orders to bills.

## Acceptance Criteria
- Orders route and update KDS in real-time; combos apply discounts.
- Void/comp processes with PIN; history reprints accurate.
- Dashboard queues refresh <1s; analytics match data.

## Artifacts
- `pos/frontend/src/subsystems/orders/Dashboard.jsx` (queues and widgets).
- `pos/frontend/src/subsystems/orders/MenuManager.jsx` (CRUD grid).
- `pos/frontend/src/subsystems/orders/OrderPlacement.jsx` (cart and send).
- `pos/frontend/src/subsystems/orders/KDS.jsx` (enhanced queues).
- `pos/backend/src/subsystems/orders/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/orders/controller.js` (extended logic).