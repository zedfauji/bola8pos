# Reservation Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem manages table bookings, availability checks, check-ins, deposits, and event handling, with advanced calendar tools and analytics for optimal table utilization.

## Features
- **Booking CRUD**:
  - **Create Booking**: Wizard form for table/group selection, customer link, date/time picker, party size, deposit amount, and notes. Validation: Real-time availability check; auto-suggest alternatives.
  - **List Bookings**: Filterable table (date, table, status, customer); calendar integration for visual overlaps.
  - **Update Booking**: Edit modal with change impact (e.g., "Extending time blocks another booking – Confirm?"). Explicit: Partial updates (e.g., add guests); deposit adjustments.
  - **Delete/Cancel**: Reason required; auto-refund deposit. Edge case: Cascade cancellations for group bookings.
- **Availability**:
  - **Slot Generation**: Dynamic 30min slots based on operating hours (configurable, e.g., 9 AM–2 AM); factor in blocks and buffers (e.g., 15min setup).
  - **Checks**: Advanced query for multi-table availability; visual heatmap of busy times. Explicit: Integration with weather APIs for outdoor tables (if applicable).
- **Check-In and Management**:
  - **Check-In**: Quick button to link to table session; auto-award loyalty points. Explicit: Late arrival grace period (15min); no-show auto-cancel with fee.
  - **Event Bookings**: Support for tournaments/parties with multi-table, custom pricing, and add-ons (e.g., catering).
- **Additional Functionalities**:
  - **Deposits and Payments**: Collect deposits via integrated payment; track refunds.
  - **Notifications**: Automated confirmations, reminders, cancellations (email/SMS).
  - **Analytics**: Booking conversion rates, peak times, revenue from reservations.
- **Edge Cases**:
  - Conflicts: Proactive resolution (e.g., "Suggest moving to Table 3?"); history of resolved conflicts.
  - Bulk Bookings: Import from CSV for events; group editing.
  - Offline: Local cache for availability; sync bookings.
  - Internationalization: Date formats in Spanish; time zones.
  - Security: PIN for cancellations; limit self-cancellations.

## Main Page
Clicking on the Reservation Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard features a full calendar view (day/week/month) with bookings highlighted, widgets for today's arrivals (list with check-in buttons), availability summary (slots available chart), and no-show alerts. It includes a sidebar for sub-modules (Bookings, Calendar, Availability, Events, Analytics), quick booking form, and customizable filters (e.g., by status). The dashboard is responsive, with dark mode, drag-and-drop for rescheduling, and export options.

## Endpoints
- `GET /api/reservations?date={date}&table={id}&status={status}` (list with calendar data).
- `POST /api/reservations` (create with deposit).
- `PUT /api/reservations/:id` (update with impact check).
- `DELETE /api/reservations/:id` (cancel with refund).
- `GET /api/reservations/availability?table={id}&date={date}` (slots with buffers).
- `POST /api/reservations/:id/check-in` (link to session).
- `GET /api/reservations/analytics` (conversions and peaks).

## Integrations
- **Table Management Subsystem**: Block tables; start sessions on check-in.
- **Customer Subsystem**: Link for loyalty; pull preferences.
- **Payment Subsystem**: Handle deposits/refunds.
- **Access Management Subsystem**: PIN for changes.

## Acceptance Criteria
- Bookings check conflicts; check-ins link sessions.
- Cancellations refund and notify; analytics accurate.
- Dashboard calendar interactive; slots generate correctly.

## Artifacts
- `pos/frontend/src/subsystems/reservations/Dashboard.jsx` (calendar and widgets).
- `pos/frontend/src/subsystems/reservations/BookingManager.jsx` (CRUD wizard).
- `pos/frontend/src/subsystems/reservations/AvailabilityChecker.jsx` (slots and heatmap).
- `pos/frontend/src/subsystems/reservations/Events.jsx` (group bookings).
- `pos/backend/src/subsystems/reservations/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/reservations/controller.js` (extended logic).