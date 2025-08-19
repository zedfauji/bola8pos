# Inventory Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem manages bar and food supplies, including advanced product handling, stock movements, supplier interactions, low-stock monitoring, and analytics. It supports the provided inventory items (e.g., "Bidón 20lt Fabuloso") and ensures real-time integration with orders for automated stock adjustments.

## Features
- **Product CRUD**:
  - **Create Product**: Step-by-step form with fields for name, unit (dropdown with custom option), price (with currency selector), category (predefined like "Limpieza" or custom), initial stock, low threshold, and optional images/descriptions. Explicit validation: Real-time duplicate check by name; enforce positive price/stock; auto-suggest categories from existing items.
  - **List Products**: Dynamic grid with customizable columns (name, stock, price, category, last updated), advanced filters (category, stock below threshold, price range), and search with autocomplete. Support bulk selection for actions like price updates, category reassign, or export to CSV/PDF. UI: Kanban view option by category; stock level progress bars (green/yellow/red).
  - **Update Product**: Inline editing in grid or full form modal; track change history. Explicit: Batch updates for prices (percentage or fixed); add notes for changes (e.g., "Supplier price increase").
  - **Delete Product**: Confirmation with impact analysis (e.g., "Linked to 5 open orders – Proceed?"); soft delete with restore option. Edge case: Auto-unlink from menu items on deletion; archive for historical reports.
  - **Bulk Import/Export**: Drag-and-drop CSV/JSON upload with mapping wizard; preview and error highlighting before import. Explicit: Handle updates on existing items (merge stock); export with filters applied.
- **Stock Movements**:
  - **Income/Purchases**: Form for adding stock via purchase orders, including supplier selection, quantity, unit cost, and batch details (e.g., expiry). Auto-update average cost. Explicit: Multi-product orders; invoice attachment upload.
  - **Expense/Sales**: Automated decrement on order completion; manual expense form for wastage/theft. Edge case: Partial decrements for combos; undo last movement with PIN.
  - **Adjustments**: Dedicated form with reason dropdown (e.g., "Inventory count discrepancy", "Damage") and notes; require PIN for adjustments >10% stock. Explicit: Before/after snapshots in history.
  - **Low-Stock Monitoring**: Configurable alerts (email/push) for thresholds; dashboard badge with clickable list. Explicit: Predictive reordering based on usage trends (e.g., "Reorder 5 units based on weekly sales").
- **Supplier Management**:
  - **CRUD Suppliers**: Form for name, contact (email, phone, address), preferred products list. Explicit: Rating system (1-5 stars) based on delivery history; contract upload.
  - **Purchase Orders**: Workflow for creating, approving, receiving orders; track status (pending, shipped, received). Edge case: Partial receives with backorder handling; return process for defects.
  - **Analytics**: Supplier performance reports (on-time delivery, cost trends).
- **Composite Items and Batches**:
  - **Bundles**: Create kits (e.g., cleaning kit: esponja + jabón); auto-check component availability on sales.
  - **Batch Tracking**: Assign lot numbers/expiries to stock; FIFO (first-in-first-out) for sales. Explicit: Expiry alerts with auto-discard workflow.
- **Additional Functionalities**:
  - **Inventory Counts**: Cycle count tool with mobile scanner support (via camera); discrepancy resolution.
  - **Usage Forecasting**: Charts predicting stock depletion based on historical orders.
  - **Wastage Tracking**: Dedicated logs with reasons and responsible employee; integrate with performance.
- **Edge Cases**:
  - Concurrent Movements: Locking mechanism during updates; optimistic concurrency with retry.
  - Negative Stock: Prevent with warnings; allow overrides with manager PIN and log.
  - Bulk Operations: Throttling for large imports (>1000 items); progress indicators.
  - Internationalization: Unit conversions (e.g., lt to gal); Spanish labels for categories.
  - Security: Role-based views (e.g., cashiers see stock levels only, managers adjust).

## Main Page
Clicking on the Inventory Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard features interactive widgets for low-stock alerts (sortable list with reorder buttons), total inventory value (pie chart by category), recent movements (timeline), and quick search bar. It includes a sidebar for sub-modules (Products, Movements, Suppliers, Analytics, Counts), customizable layouts (drag widgets), and views tailored by role (e.g., managers see forecasts). The dashboard is responsive, with dark mode, export buttons, and integration previews (e.g., linked menu items).

## Endpoints
- `GET /api/inventory/products?category={category}&low={1}&search={query}&sort={field}` (advanced list).
- `POST /api/inventory/products` (create with images).
- `PUT /api/inventory/products/:id` (update with history).
- `DELETE /api/inventory/products/:id` (delete with impact).
- `POST /api/inventory/stock/movement` (income/expense/adjustment).
- `GET /api/inventory/low-stock?threshold={number}&predict={true}` (alerts with forecasts).
- `POST /api/inventory/suppliers` (create with ratings).
- `POST /api/inventory/purchase-orders` (order workflow).

## Integrations
- **Order Management Subsystem**: Auto-decrement stock on completions; flag low stock in order entry.
- **Reporting Subsystem**: Provide movement data for COGS and wastage reports.
- **Settings Subsystem**: Pull default categories/units; apply currency for prices.
- **Supplier Integrations**: API hooks for external vendor sync (e.g., auto-reorder).

## Acceptance Criteria
- Product updates reflect in dashboard widgets instantly; bulk import handles duplicates.
- Stock movements trigger alerts; forecasts accurate based on mock data.
- Supplier orders transition statuses; partial receives update correctly.
- Subsystem dashboard loads efficiently; navigation smooth.

## Artifacts
- `pos/frontend/src/subsystems/inventory/Dashboard.jsx` (widgets and previews).
- `pos/frontend/src/subsystems/inventory/ProductGrid.jsx` (CRUD and bulk).
- `pos/frontend/src/subsystems/inventory/Movements.jsx` (logs and adjustments).
- `pos/frontend/src/subsystems/inventory/Suppliers.jsx` (CRUD and analytics).
- `pos/backend/src/subsystems/inventory/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/inventory/controller.js` (extended logic).