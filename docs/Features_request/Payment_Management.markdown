# Payment Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem processes bills, handles diverse payment methods, generates receipts, manages refunds, and integrates closely with tables and discounts for efficient checkouts.

## Features
- **Bill Finalization**:
  - **Pre-Bill Preview**: Modal with itemized breakdown (time charges post-free 10min, services, orders, discounts applied); editable notes. Explicit: Tax calculation modes (inclusive/exclusive, per settings); service charge auto-add (e.g., 10% on groups >4).
  - **Bill Splitting**: Options for even split, by item, or custom amounts; preview per payer.
- **Payment Processing**:
  - **Methods**: Cash (with change calculator), card (simulate gateway), split (interactive slider, quick buttons for 25/50/75%, validate total). Explicit: Digital wallets (e.g., SPEI for Mexico); pre-authorization for tabs.
  - **Tips**: Suggested buttons (10/15/20%, configurable), manual entry; apply to pre/post-tax. Edge case: Tip pooling for staff distribution.
  - **Process Payment**: One-click finalization; mark paid and free table. Explicit: Partial payments with balance tracking; installment options.
  - **Refunds**: Form for partial/full refund with reason, PIN, and receipt reissue. Edge case: Time-based refunds (e.g., unused table time); integrate with inventory for returns.
- **Receipts**:
  - **Generation**: Customizable template with store details, item lines, discounts/tax/tip, payment breakdown, QR for feedback. Explicit: Multi-language (Spanish/English); fiscal invoice compliance for Mexico (e.g., SAT requirements).
  - **Formats and Delivery**: 58mm/80mm thermal; email/SMS receipt option. Edge case: Reprint from history; batch receipts for groups.
- **Pending Bills**:
  - **List and Monitoring**: Filterable table (by table, amount, age); 10s auto-refresh. Explicit: Alerts for overdue bills (>1h); merge pending from same table.
- **Additional Functionalities**:
  - **Tab Management**: Open tabs with pre-auth; auto-close at end of day.
  - **Analytics**: Payment trends (methods pie), average tip %, refund rates.
  - **Compliance**: Tax reporting previews; audit-ready logs for transactions.
- **Edge Cases**:
  - Insufficient Tender: Error messages with suggestions (e.g., "Add card for remaining $10").
  - Offline: Local processing with sync; handle duplicate payments on reconnect.
  - Bulk Payments: Process multiple bills at once (e.g., group event).
  - Internationalization: MXN formatting; VAT-like tax labels.
  - Security: Encrypt tenders; fraud detection (e.g., unusual refund patterns).

## Main Page
Clicking on the Payment Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard lists pending bills in a sortable grid (table, amount, time open), with widgets for daily totals (sales chart), payment method breakdown (pie), and refund alerts. It includes a sidebar for sub-modules (Bills, Payments, Receipts, Refunds, Analytics), quick search by bill ID/table, and role-based views (e.g., cashiers see simple list, managers see analytics). The dashboard is responsive, with dark mode, touch support for quick processing, and live polling.

## Endpoints
- `GET /api/bills/pending?table={id}&status={pending}` (list with filters).
- `POST /api/bills/pay-by-table` (process with splits/tips).
- `GET /api/bills/:id/preview` (pre-bill data).
- `POST /api/bills/:id/refund` (process with reason).
- `GET /api/bills/receipt/:id` (generate receipt).
- `GET /api/payments/analytics` (trends and breakdowns).

## Integrations
- **Table Management Subsystem**: Pull session data for finalization.
- **Discount Subsystem**: Apply and validate discounts in previews.
- **Settings Subsystem**: Use tax/tip/receipt configs.
- **Access Management Subsystem**: PIN for refunds/process.

## Acceptance Criteria
- Bill previews include all charges; payments update statuses instantly.
- Splits validate totals; receipts show breakdowns accurately.
- Refunds process with logs; offline queues sync without duplicates.

## Artifacts
- `pos/frontend/src/subsystems/payment/Dashboard.jsx` (bills list and widgets).
- `pos/frontend/src/subsystems/payment/BillFinalization.jsx` (preview and splitting).
- `pos/frontend/src/subsystems/payment/PaymentProcessing.jsx` (methods and tips).
- `pos/frontend/src/subsystems/payment/Receipts.jsx` (generation and delivery).
- `pos/backend/src/subsystems/payment/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/payment/controller.js` (extended logic).