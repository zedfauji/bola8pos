# Shift Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem controls cash shifts, detailed reconciliations, movements, history reviews, and analytics, ensuring precise cash management and compliance.

## Features
- **Shift Lifecycle**:
  - **Open Shift**: Form with employee selector, start cash entry (denominations or total), and notes. Explicit: Auto-pull from schedule; require PIN for non-scheduled opens.
  - **Close Shift**: Multi-step wizard for counting (denominations grid with auto-sum, manual override), over/short calculation with explanations. Explicit: Photo upload for proof; integration with safe drop logs.
  - **Movements**: Forms for drops (add cash with source), payouts (remove with recipient/reason, always PIN), adjustments (positive/negative with approval). Explicit: Real-time drawer balance tracker; limits per type.
- **Reconciliation**:
  - **Denominations Counter**: Interactive inputs for each MXN denomination (coins/notes); live variance display. Toggle between detailed and quick total entry.
  - **Over/Short Handling**: Color-coded previews; mandatory comments for discrepancies >$5; auto-alert manager.
- **History and Reviews**:
  - **Shift List**: Filterable table (employee, date, over/short); detailed view with movements timeline.
  - **Print/Export**: Customizable summaries (include movements, variances); PDF with signatures.
  - Explicit: Dispute resolution workflow (re-open closed shift with PIN).
- **Additional Functionalities**:
  - **Cash Drawer Analytics**: Trends on over/short frequencies; employee comparisons.
  - **Safe Drops**: Track transfers to safe; end-of-day reconciliation.
  - **Compliance**: Generate labor-compliant reports (hours vs. cash handled).
- **Edge Cases**:
  - Negative Balances: Prevent close; suggest adjustments.
  - Offline: Local tracking; sync movements.
  - Bulk Closes: For multi-cashier setups; consolidate.
  - Internationalization: MXN-specific denominations; Spanish UI.
  - Security: PIN for all movements; anomaly flags (e.g., frequent payouts).

## Main Page
Clicking on the Shift Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard shows active shift details (current balance, movements list), history summary (over/short chart), and widgets for daily cash flow. It includes a sidebar for sub-modules (Shifts, Movements, History, Analytics), quick open/close buttons, and employee filters. The dashboard is responsive, with dark mode, real-time balance updates, and customizable alerts.

## Endpoints
- `POST /api/shifts/open` (start with denominations).
- `POST /api/shifts/:id/close` (close with variance).
- `POST /api/shifts/:id/movement` (add with limits).
- `GET /api/shifts/history?employee={id}&from={date}` (list with details).
- `GET /api/shifts/analytics` (trends and comparisons).

## Integrations
- **Payment Subsystem**: Update expected cash from transactions.
- **Employee Subsystem**: Link to schedules and performance.
- **Access Management Subsystem**: PIN for actions.

## Acceptance Criteria
- Shift closes calculate variances; movements update balances.
- History views detailed; exports include all data.
- Offline sync handles conflicts.

## Artifacts
- `pos/frontend/src/subsystems/shifts/Dashboard.jsx` (active and widgets).
- `pos/frontend/src/subsystems/shifts/Lifecycle.jsx` (open/close wizards).
- `pos/frontend/src/subsystems/shifts/Movements.jsx` (logs and adds).
- `pos/frontend/src/subsystems/shifts/History.jsx` (list and exports).
- `pos/backend/src/subsystems/shifts/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/shifts/controller.js` (extended logic).