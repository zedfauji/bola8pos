# Billiard Parlor POS Design Document (Web-Based with Offline Support, KDS, Cashier Screen, Access Codes, Robust Reporting, and Anti-Theft Features)

This document outlines the design for an elegant, user-friendly, web-based Point of Sale (POS) system for a billiard parlor with bar and restaurant operations, deployed as a Progressive Web App (PWA) on Windows 11 with offline availability. It includes mockups, UI/UX flows, data flows, transactional flows, and functionalities, formatted as a JSON skeleton and Mermaid diagrams for integration with Cursor AI. The update enhances reliability (e.g., backups, encryption), adds anti-theft features (e.g., audit logs, cash reconciliation, anomaly alerts), improves employee control (e.g., RBAC, biometric login), and prevents manipulations (e.g., manager approvals for voids/discounts, CCTV integration).

## 1. Overview
The POS system streamlines billiard table rentals, food/drink orders, payment processing, and reporting, with a focus on:
- **Web-Based**: Built using React (CDN-hosted via cdn.jsdelivr.net) and Node.js, deployable as a PWA.
- **Offline Availability**: Uses service workers (Workbox) and IndexedDB to cache data and queue transactions during internet interruptions.
- **Elegance**: Modern, dark-themed UI (#1E1E1E, #4CAF50 accents) with large, touch-friendly buttons styled with Tailwind CSS.
- **Ease of Use**: Intuitive navigation, color-coded table statuses, quick-access menus.
- **Billiard-Specific Features**: Table timers, light controllers, table migration, combo offers, three table types (Billiard, Normal Bar & Restaurant, La Barra).
- **New Features for Reliability, Employee Control, and Anti-Theft**:
  - **Reliability**: Automatic data backups, encryption for sensitive data (e.g., payments), error logging, and redundancy (cloud hosting with failover).
  - **Employee Control**: Granular Role-Based Access Control (RBAC), biometric/PIN login, shift management with cash counts, anomaly detection alerts (e.g., frequent voids).
  - **Anti-Theft/Manipulation Prevention**: Detailed audit logs for all actions, manager approvals for voids/refunds/discounts, cash drawer reconciliation, inventory discrepancy alerts, CCTV integration for timestamped actions, and automated reports for suspicious activities.
  - **Robust Reporting and Analytics**: Complex reports (sales, table usage, inventory, combos, employee performance, customer retention), customizable filters, interactive charts, trends, forecasts, and theft detection insights.
- **Edge Cases**: Partial time transfers, multi-table groups, combo expiration, access code failures, inventory discrepancies.
- **Windows Compatibility**: Runs on Windows 11 browsers (Edge, Chrome) as a PWA, touch-optimized.

## 2. Mockups
The UI is designed for a 1920x1080 touchscreen display, optimized for web browsers and Windows 11 PWA installation, with offline support, access code prompts, and anti-theft indicators (e.g., audit alerts).

### 2.1 Home Screen
- **Description**: Central hub for staff with tabs for Table Management, Order Entry, Combos, Reports, Analytics, and Audit Logs.
- **Layout**:
  - Top Bar: Navigation (Table Management, Orders, Combos, Reports, Analytics, Audit Logs, Settings), offline status indicator (e.g., “Offline Mode” in red), user role (e.g., “Manager”).
  - Main Area: Quick-access buttons (e.g., “Assign Table,” “New Order,” “Apply Combo,” “Start Shift”).
  - Sidebar: Recent transactions, alerts (e.g., low inventory, suspicious voids, cash discrepancies).
- **Design**: Dark background (#1E1E1E), white text (#FFFFFF), Tailwind CSS (`bg-green-500` for buttons), offline alert banner, anomaly alert badges (`bg-red-500`).
- **Access Control**: Access code modal for actions like table assignment or order creation.

### 2.2 Table Management Screen
- **Description**: Displays tables in a virtual floor plan, categorized by type, with anti-theft alerts (e.g., unauthorized access attempts).
- **Layout**:
  - Tabs: Billiard Tables, Normal Tables, La Barra.
  - Grid of tables, each showing:
    - Table ID (e.g., Billiard 1, Normal 2, La Barra A).
    - Type: Billiard (timer-enabled), Normal (no timer), La Barra (counter seating).
    - Status: Green (available), Red (occupied), Yellow (reserved).
    - Timer (Billiard only): Running time (e.g., 01:23:45).
  - Actions: Start/Stop Timer (Billiard), Assign Customer, Migrate Table, Control Lights (Billiard).
- **Design**: Rounded buttons (100x100px, `rounded-lg`), hover effects (`hover:bg-green-600`), type-specific icons, access code modal.
- **Offline Support**: Table statuses cached in IndexedDB, synced on reconnect.

### 2.3 Order Entry Screen
- **Description**: Grid-based menu for food/drink orders and combos, with manipulation prevention (e.g., discount approvals).
- **Layout**:
  - Left: Categories (Food, Drinks, Specials, Combos) as swipeable tabs.
  - Center: Grid of items (e.g., Burger, $15) and combos (e.g., “Burger + Beer + 1hr Billiard, $25”).
  - Right: Order summary (items, quantities, total, combo discounts).
  - Bottom: Actions (Add to Table, Apply Combo, Send to KDS, Clear, Apply Discount – requires manager code).
- **Design**: High-contrast buttons (`bg-green-500 text-white`), pop-up modals for modifiers (`shadow-lg`), access code prompt for discounts/voids.
- **Offline Support**: Orders cached in IndexedDB, KDS updates queued.

### 2.4 Cashier Screen
- **Description**: Dedicated screen for cashiers, focusing on payments, table operations, and cash reconciliation.
- **Layout**:
  - Top: Search bar for table/customer, offline status indicator, cash drawer balance.
  - Center: Table list (Billiard, Normal, La Barra) with status, timer (Billiard), order summary.
  - Right: Payment form (total, payment method, tip), cash count input for shift end.
  - Bottom: Actions (Assign Table, Process Payment, Split Bill, Print Receipt, Reconcile Cash).
- **Design**: Simplified layout (`flex flex-col`), large buttons (`w-48 h-12`), access code modal, discrepancy alert (`bg-red-500`).
- **Offline Support**: Cash payments processed locally, card payments queued in IndexedDB.

### 2.5 Kitchen Display System (KDS)
- **Description**: Screen for kitchen/bar staff to manage orders, with manipulation tracking (e.g., order rejection logs).
- **Layout**:
  - Top: Filter (Pending, In Progress, Completed).
  - Center: Order cards (e.g., Order #123: Burger, No Onion, Table Billiard 1).
  - Bottom: Actions (Mark In Progress, Mark Completed, Reject).
- **Design**: Card-based layout (`border-green-500`), high-contrast text, WebSocket updates (IndexedDB offline).
- **Offline Support**: Orders cached, completion status queued for sync.

### 2.6 Reporting and Analytics Dashboard
- **Description**: Displays complex reports and analytics with interactive charts, including anti-theft insights (e.g., void trends).
- **Layout**:
  - Top: Filters (Date Range, Table Type, Employee, Report Type: Sales, Table Usage, Inventory, Combos, Employee Performance, Customer Retention, Audit Logs, Anomaly Detection).
  - Center: Interactive charts (bar, line, pie) for:
    - Sales by table type, item, time period.
    - Table utilization rates (e.g., Billiard vs. Normal).
    - Combo redemption trends.
    - Inventory turnover and restock predictions.
    - Employee performance (sales, voids, discounts, access code usage).
    - Customer retention (membership usage, repeat rates).
    - Audit logs (actions, timestamps, employees).
    - Anomaly detection (frequent voids, cash discrepancies).
  - Bottom: Export options (PDF, Excel, CSV, cached locally), drill-down toggles, alert settings (e.g., email for anomalies).
- **Design**: Chart.js visualizations (`border-green-500`), dark background, access code for access/export, offline data caching.
- **Analytics Features**:
  - **Trends**: Revenue growth, peak hours, combo usage, void patterns.
  - **Forecasts**: Predictive restocking, theft risk based on anomalies.
  - **Drill-Down**: Click charts to view details (e.g., employee-specific voids).
  - **Anomaly Detection**: Alerts for suspicious activities (e.g., high void rates, inventory mismatches).
- **Offline Support**: Reports generated from local data, exports saved to IndexedDB.

### 2.7 Audit Log Screen
- **Description**: Dedicated screen for viewing audit logs to track manipulations.
- **Layout**:
  - Top: Filters (Date Range, Employee, Action Type: Voids, Discounts, Payments, Table Migrations).
  - Center: Log table (Timestamp, Employee, Action, Details, IP Address, CCTV Timestamp Link).
  - Bottom: Export options (PDF, Excel), alert setup for suspicious patterns.
- **Design**: Table layout (`border-green-500`), searchable, access code required.
- **Offline Support**: Logs cached in IndexedDB, synced on reconnect.

## 3. UI/UX Flows
The flows ensure seamless navigation, with access code prompts, offline feedback, and anti-theft checks.

### 3.1 Table Assignment Flow
- **Steps**:
  1. Home/Cashier Screen → Click “Table Management.”
  2. Enter access code → Select tab (Billiard, Normal, La Barra) → Choose available table.
  3. Click “Assign Customer” → Enter details (name, membership ID).
  4. For Billiard: Start timer automatically.
  5. System logs action in audit log.
- **UX**: Type-specific tabs, one-tap assignment, access code modal, offline “Cached” status.
- **Offline**: Assignment stored in IndexedDB, synced on reconnect.

### 3.2 Table Migration Flow
- **Steps**:
  1. Table Management → Enter access code → Select occupied Billiard table.
  2. Click “Migrate Table” → Choose new table.
  3. System transfers time and orders → Starts timer on new table.
  4. Original table marked available, light turned off.
  5. Log migration in audit log, check for anomalies (e.g., frequent migrations).
- **UX**: Drag-and-drop interface, confirmation modal with access code, offline queue.
- **Offline**: Migration stored in IndexedDB, synced on reconnect.

### 3.3 Order Entry Flow
- **Steps**:
  1. Home Screen → Click “Orders.”
  2. Enter access code → Select table or customer.
  3. Choose category (e.g., Combos) → Click items or combo.
  4. Add modifiers → Enter access code for discounts/voids → Send to KDS.
  5. Update order summary, log action in audit log.
- **UX**: Swipeable categories, large buttons (`w-36 h-36`), access code for changes, offline alert.
- **Offline**: Orders cached in IndexedDB, KDS updates queued.

### 3.4 Payment Flow
- **Steps**:
  1. Cashier Screen → Enter access code → Select table/order.
  2. View combined total (table rental + items + combo discounts).
  3. Choose payment method → Enter tip → Process payment.
  4. Generate receipt → Free table (stop timer for Billiard).
  5. Log payment in audit log, reconcile cash drawer if cash payment.
- **UX**: Clear total breakdown, touch-friendly inputs, access code prompt, offline alert.
- **Offline**: Cash payments processed, card payments queued in IndexedDB.

### 3.5 Combo Application Flow
- **Steps**:
  1. Order Entry → Enter access code → Select “Combos” tab.
  2. Choose combo (e.g., “Burger + Beer + 1hr Billiard, $25”).
  3. Assign to Billiard table → Apply discount and timer credit.
  4. Update order summary and send to KDS.
  5. Log combo application in audit log.
- **UX**: Combo buttons highlighted (`bg-green-500`), modal showing savings, access code.
- **Offline**: Combo data cached, applied locally, synced on reconnect.

### 3.6 KDS Flow
- **Steps**:
  1. KDS Screen → View pending orders.
  2. Click “Mark In Progress” → Update status.
  3. Click “Mark Completed” → Notify POS.
  4. Optional: Reject order with reason (e.g., out of stock).
  5. Log KDS actions in audit log.
- **UX**: Card-based orders, large buttons (`w-48 h-12`), real-time updates, offline caching.
- **Offline**: Order statuses cached in IndexedDB, synced on reconnect.

### 3.7 Reporting and Analytics Flow
- **Steps**:
  1. Home Screen → Click “Reports” or “Analytics.”
  2. Enter access code → Select report type (e.g., Sales, Table Usage, Audit Logs, Anomaly Detection).
  3. Apply filters (date range, table type, employee).
  4. Apply filters (date range, table type, employee).
  5. View interactive charts → Drill down for details (e.g., employee voids).
  6. Export as PDF/Excel/CSV (cached offline).
  7. System generates alerts for anomalies (e.g., high void rates).
- **UX**: Filter dropdowns, interactive Chart.js visuals, access code modal, offline data display.
- **Offline**: Reports generated from IndexedDB, exports queued.

### 3.8 Shift Management and Reconciliation Flow
- **Steps**:
  1. Home/Cashier Screen → Click “Start/End Shift.”
  2. Enter biometric/PIN for login/logout.
  3. At shift end: Enter cash count → System reconciles against expected amount.
  4. Log discrepancies in audit log, generate report.
  5. Alert manager if variance exceeds threshold (e.g., $10).
- **UX**: Simple form (`flex flex-col`), access code/biometric modal, discrepancy alert (`bg-red-500`).
- **Offline**: Shift data cached in IndexedDB, synced on reconnect.

### 3.9 Audit Log Flow
- **Steps**:
  1. Reporting Dashboard → Click “Audit Logs.”
  2. Enter access code → Apply filters (date, employee, action type).
  3. View log table → Click entry for details (e.g., CCTV link).
  4. Export logs.
- **UX**: Searchable table, detailed modals, access code required.
- **Offline**: Logs cached in IndexedDB, synced on reconnect.

## 4. Data Flows
The data flow includes KDS, cashier operations, access code validation, reporting, and audit logs.

### 4.1 Mermaid Data Flow Diagram
```mermaid
graph TD
    A[Customer] -->|Requests Table| B[POS Terminal]
    B -->|Assigns Table (Access Code/Biometric)| C[TableStatus DB]
    B -->|Migrates Table (Access Code)| C
    B -->|Enters Order/Combo (Access Code)| D[Orders DB]
    D -->|Sends to KDS| E[KDS]
    D -->|Updates Stock| F[Inventory DB]
    D -->|Applies Combo (Access Code)| G[Combos DB]
    B -->|Processes Payment (Access Code)| H[Payment Gateway]
    H -->|Logs Transaction| I[Transactions DB]
    I -->|Generates Report/Analytics (Access Code)| J[Reports DB]
    J -->|Analytics Insights (Trends/Forecasts)| K[Analytics Engine]
    B -->|Validates Access Code/Biometric| L[Auth DB]
    B -->|Logs Action/Audit| M[Audit Logs DB]
    M -->|Detects Anomalies/Alerts| N[Alert System]
    B -->|Reconciles Cash/Shift| O[Cash Reconciliation DB]
    B -->|Integrates CCTV Timestamp| P[CCTV System]
    F -->|Detects Discrepancies| N
```

### 4.2 Description
- **Entities**: Customer, POS Terminal, TableStatus DB, Orders DB, KDS, Inventory DB, Combos DB, Payment Gateway, Transactions DB, Reports DB, Analytics Engine, Auth DB, Audit Logs DB, Alert System, Cash Reconciliation DB, CCTV System.
- **Processes**:
  - **Table Assignment/Migration**: Customer → POS Terminal → Access Code/Biometric Check (Auth DB) → TableStatus DB → Log in Audit Logs DB.
  - **Order/Combo Entry**: POS Terminal → Access Code Check → Orders DB → KDS, Inventory DB, Combos DB → Log in Audit Logs DB.
  - **Payment Processing**: POS Terminal → Access Code Check → Payment Gateway → Transactions DB → Log in Audit Logs DB.
  - **Reporting/Analytics**: Transactions DB → Access Code Check → Reports DB → Analytics Engine (trends, forecasts) → Log in Audit Logs DB.
  - **KDS**: Orders DB → KDS → Update order status → Log in Audit Logs DB.
  - **Anti-Theft**: Audit Logs DB → Anomaly Detection (Alert System) for voids, discounts, discrepancies.
  - **Cash Reconciliation**: POS Terminal → Cash Reconciliation DB → Detect discrepancies → Alert System.
  - **CCTV Integration**: POS Terminal → Timestamp actions → CCTV System.
  - **Reliability**: Automatic backups (e.g., daily to cloud), encryption for payments/transactions.

## 5. Transactional Flows
The transactional flow includes KDS, cashier operations, access codes, reporting, and anti-theft logs.

### 5.1 Mermaid Transactional Flow Diagram
```mermaid
sequenceDiagram
    participant C as Customer
    participant P as POS Terminal
    participant A as Auth DB
    participant T as TableStatus DB
    participant O as Orders DB
    participant K as KDS
    participant I as Inventory DB
    participant M as Combos DB
    participant G as Payment Gateway
    participant R as Transactions DB
    participant S as Reports DB
    participant E as Analytics Engine
    participant L as Audit Logs DB
    participant N as Alert System
    participant Q as Cash Reconciliation DB
    participant V as CCTV System
    C->>P: Request Billiard Table
    P->>A: Validate Access Code/Biometric
    P->>T: Assign Table, Start Timer
    P->>L: Log Assignment
    C->>P: Request Table Migration
    P->>A: Validate Access Code
    P->>T: Transfer Time/Orders to New Table
    T->>P: Free Original Table, Start New Timer
    P->>L: Log Migration
    P->>V: Timestamp Migration Action
    C->>P: Place Order/Combo
    P->>A: Validate Access Code
    P->>O: Log Order
    P->>M: Apply Combo (Discount + Time Credit)
    O->>K: Send to KDS
    K->>O: Update Order Status (Completed)
    O->>I: Update Inventory
    P->>L: Log Order/Combo
    P->>N: Check for Anomalies (e.g., Frequent Discounts)
    C->>P: Request Bill
    P->>A: Validate Access Code
    P->>O: Calculate Total (Table + Order + Combo)
    P->>G: Process Payment
    G->>R: Log Transaction
    P->>T: Stop Timer, Free Table
    P->>C: Issue Receipt
    P->>L: Log Payment
    P->>V: Timestamp Payment Action
    P->>Q: Reconcile Cash (if cash payment)
    Q->>N: Alert if Discrepancy
    P->>A: Validate Access Code
    P->>S: Generate Report (Sales, Table Usage, Combos)
    S->>E: Analyze Trends, Forecasts
    P->>L: Log Report Generation
    E->>N: Alert on Theft Risks (e.g., High Voids)
```

### 5.2 Description
- **Table Rental**: Customer requests Billiard table → Access code/biometric validated → POS assigns table, starts timer → Logs in TableStatus DB and Audit Logs DB.
- **Table Migration**: Customer requests migration → Access code validated → POS transfers time/orders → Starts new timer, frees original table → Logs in Audit Logs DB, timestamps with CCTV.
- **Order/Combo Processing**: Customer orders food/drinks or combo → Access code validated → POS logs order, applies combo discounts/time credits → Sends to KDS, updates Inventory DB → Logs in Audit Logs DB, checks for anomalies.
- **KDS**: KDS receives order → Staff marks In Progress/Completed → Updates Orders DB → Logs in Audit Logs DB.
- **Payment**: Customer requests bill → Access code validated → POS combines totals → Processes payment → Logs in Transactions DB and Audit Logs DB → Reconciles cash in Cash Reconciliation DB, alerts discrepancies → Frees table.
- **Reporting/Analytics**: Access code validated → Generate reports (sales, table usage, combos) → Analyze trends/forecasts in Analytics Engine → Logs in Audit Logs DB → Alerts for theft risks.
- **Shift Management**: Employee starts/ends shift → Biometric/PIN validation → Cash count reconciliation → Logs in Audit Logs DB, alerts discrepancies.
- **Example**: Customer rents Billiard 1 for 1 hour ($10), migrates to Billiard 2, orders combo ($25, includes 1-hour credit). Total $25 paid, order sent to KDS, report shows combo redemption, audit log tracks actions, anomaly alert if voids exceed threshold. Offline: Transactions queued in IndexedDB.
- **Reliability**: Automatic backups (daily cloud snapshots), data encryption (AES for payments), error logging (Sentry integration), redundancy (cloud failover).

## 6. Functionalities
Key functionalities, enhanced with reliability, employee control, and anti-theft:
- **Table Management**:
  - Track rental time for Billiard tables ($8-$12/hr, configurable).
  - Migrate customers between Billiard tables, preserving time and orders.
  - Support three table types: Billiard (timers, lights), Normal (orders), La Barra (quick orders).
  - Control Billiard table lights via relay.
  - Handle waiting lists and group assignments.
- **Order Management**:
  - Grid-based menu with categories (Food, Drinks, Specials, Combos).
  - Combo offers (e.g., “Burger + Beer + 1hr Billiard, $25” with $5 discount).
  - Modifiers and happy hour pricing.
  - Send orders to KDS.
  - Require manager access code for voids, refunds, discounts.
- **Kitchen Display System (KDS)**:
  - Display orders with table and modifier details.
  - Update status (Pending, In Progress, Completed, Rejected).
  - Real-time updates via WebSocket (IndexedDB offline).
- **Cashier Screen**:
  - Handle table assignments, payments, and order summaries.
  - Support EMV card payments, cash, gift cards, split billing, tip input.
  - Cash drawer reconciliation at shift end, with discrepancy alerts.
- **Access Control**:
  - Require access codes/biometric (fingerprint/PIN) for operations: table assignment/migration, order/combo entry, payments, KDS updates, report generation, voids/discounts/refunds.
  - Granular RBAC (e.g., Cashier: payments only; Manager: approvals; Kitchen: KDS only) stored in Auth DB.
  - Log all access attempts, lock after failures.
- **Inventory Tracking**:
  - Real-time stock updates (three-decimal precision for liquor).
  - Low-stock alerts and reorder thresholds.
  - Discrepancy detection (e.g., expected vs. actual stock) with alerts.
- **Reporting and Analytics**:
  - **Reports**:
    - Sales: By table type, item, time period (hourly, daily, weekly, monthly).
    - Table Usage: Utilization rates, average rental time, peak hours by type.
    - Inventory: Turnover rates, low-stock alerts, restock predictions, discrepancies.
    - Combos: Redemption rates, popularity by combo type.
    - Employee Performance: Sales, voids, discounts, access code usage, shift cash counts.
    - Customer Retention: Membership usage, repeat rates via loyalty program.
    - Audit Logs: All actions (timestamps, employees, IP addresses, CCTV links).
    - Anomaly Detection: Suspicious activities (frequent voids, cash variances, inventory mismatches).
  - **Analytics**:
    - Trends: Revenue growth, peak hours, combo popularity, void patterns.
    - Forecasts: Predictive restocking, theft risk based on anomalies.
    - Drill-Down: Detailed views (e.g., employee-specific voids, table-specific sales).
  - **Customization**: Filters for date ranges, table types, employees; export to PDF, Excel, CSV.
  - **Visualization**: Interactive Chart.js charts (bar, line, pie).
  - **Offline Support**: Generate reports from IndexedDB, queue exports.
  - **Anti-Theft Insights**: Alerts for anomalies (e.g., email/SMS for high voids), integration with CCTV for video-linked logs.
- **Anti-Theft and Manipulation Prevention**:
  - **Audit Logs**: Track all actions (e.g., voids, discounts, payments, migrations) with timestamps, employee IDs, IP addresses, and CCTV timestamps.
  - **Anomaly Detection**: Automated alerts for suspicious patterns (e.g., frequent voids, cash shortages, inventory discrepancies).
  - **Manager Approvals**: Require manager access code for sensitive actions (voids, refunds, discounts, overrides).
  - **Cash Management**: End-of-shift reconciliation with expected vs. actual cash counts, logged in audit logs.
  - **CCTV Integration**: Timestamp POS actions to video footage for verification.
  - **Inventory Audits**: Regular checks for discrepancies, alerting on mismatches (e.g., stolen items).
  - **Employee Monitoring**: Performance reports on voids/discounts, access logs to prevent unauthorized changes.
- **Reliability Features**:
  - Automatic backups (daily cloud snapshots with encryption).
  - Data encryption (AES for payments, transactions; HTTPS for all communications).
  - Error logging and monitoring (integration with Sentry for crash reports).
  - Redundancy (cloud hosting with failover servers).
  - Data recovery tools (e.g., restore from backups).
- **Offline Support**:
  - Cache table statuses, orders, inventory, combos, audit logs in IndexedDB.
  - Queue transactions (payments, migrations, KDS updates, audit entries) for sync.
  - Display offline status and sync progress.
- **Edge Cases**:
  - **Partial Time Transfers**: Split time across tables with access code.
  - **Multi-Table Groups**: Link one order to multiple tables, split billing.
  - **Combo Expiration**: Track 1-hour billiard credits, expire after session.
  - **Access Code Failure**: Prompt re-entry, lock after 3 failures.
  - **Report Granularity**: Handle large datasets with pagination.
  - **Cash Discrepancy**: Alert and log if end-of-shift count doesn't match.
  - **Inventory Mismatch**: Alert on discrepancies, trigger audit.
- **Integrations**:
  - Payment gateways (Stripe, Square).
  - Light controllers for Billiard tables.
  - Loyalty programs for membership tracking.
  - CCTV systems for video timestamps.
  - Alert systems (email/SMS for anomalies).
  - Backup services (e.g., AWS S3 for encrypted backups).

## 7. JSON Skeleton for Cursor AI
This JSON skeleton describes the UI components, data flows, and functionalities, ready for Cursor AI to generate a web-based POS with offline support, robust reporting, and anti-theft features.

```json
{
  "pos_system": {
    "name": "Billiard Parlor POS",
    "platform": "Web (PWA)",
    "version": "1.0.4",
    "theme": {
      "background": "#1E1E1E",
      "text": "#FFFFFF",
      "accent": "#4CAF50",
      "font": "Segoe UI",
      "font_size": "16px",
      "tailwind_classes": ["bg-gray-900", "text-white", "bg-green-500"]
    },
    "reliability_features": {
      "backups": "daily_cloud_snapshots",
      "encryption": "AES_payments_transactions",
      "error_logging": "Sentry_integration",
      "redundancy": "cloud_failover"
    },
    "offline_support": {
      "service_worker": "Workbox",
      "local_storage": "IndexedDB",
      "cached_data": ["table_status", "orders", "inventory", "combos", "reports", "audit_logs"],
      "queued_actions": ["table_migration", "order_entry", "payment_processing", "kds_updates", "report_generation", "audit_logging"]
    },
    "table_types": [
      {
        "type": "Billiard",
        "features": ["timer", "light_controller", "membership_discounts"],
        "rate": {"standard": 10.00, "happy_hour": 8.00}
      },
      {
        "type": "Normal",
        "features": ["order_management"],
        "rate": 0.00
      },
      {
       "type": "La Barra",
        "features": ["quick_order"],
        "rate": 0.00
      }
    ],
    "modules": [
      {
        "name": "TableManagement",
        "ui_components": [
          {
            "id": "table_layout",
            "type": "grid",
            "description": "Virtual floor plan of tables by type",
            "properties": {
              "tabs": ["Billiard", "Normal", "La Barra"],
              "layout": "4x4_grid",
              "elements": [
                {
                  "id": "billiard_1",
                  "type": "button",
                  "label": "Billiard 1",
                  "table_type": "Billiard",
                  "size": "100x100px",
                  "status": "available",
                  "timer": "00:00:00",
                  "actions": ["start_timer", "assign_customer", "stop_timer", "control_light", "migrate_table"],
                  "requires_access_code": true
                },
                {
                  "id": "normal_1",
                  "type": "button",
                  "label": "Normal 1",
                  "table_type": "Normal",
                  "size": "100x100px",
                  "status": "available",
                  "actions": ["assign_customer", "migrate_table"],
                  "requires_access_code": true
                },
                {
                  "id": "la_barra_a",
                  "type": "button",
                  "label": "La Barra A",
                  "table_type": "La Barra",
                  "size": "100x100px",
                  "status": "available",
                  "actions": ["assign_customer", "migrate_table"],
                  "requires_access_code": true
                }
              ],
              "color_coding": {
                "available": "#4CAF50",
                "occupied": "#F44336",
                "reserved": "#FFC107"
              }
            }
          },
          {
            "id": "waiting_list",
            "type": "list",
            "description": "Customers waiting for tables",
            "actions": ["add_customer", "remove_customer", "assign_table"],
            "requires_access_code": true
          }
        ],
        "dataflow": {
          "entities": ["Table", "Customer", "Auth", "Audit"],
          "processes": [
            {
              "name": "validate_access_code",
              "input": {"user_id": "string", "access_code": "string"},
              "output": {"is_valid": "boolean"}
            },
            {
              "name": "assign_table",
              "input": {"customer_id": "string", "table_id": "string", "table_type": "string"},
              "output": {"table_status": "occupied", "start_time": "timestamp"}
            },
            {
              "name": "migrate_table",
              "input": {"customer_id": "string", "from_table_id": "string", "to_table_id": "string", "partial_time": "boolean"},
              "output": {"new_table_status": "occupied", "new_start_time": "timestamp", "orders_transferred": "boolean"}
            },
            {
              "name": "log_action",
              "input": {"action_type": "string", "employee_id": "string", "details": "object"},
              "output": {"audit_id": "string"}
            }
          ],
          "data_store": {
            "TableStatus": {
              "fields": ["table_id", "table_type", "status", "start_time", "customer_id", "rental_time"]
            },
            "Auth": {
              "fields": ["user_id", "role", "access_code", "biometric_data"]
            },
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            }
          }
        },
        "functionalities": [
          "Track Billiard table rental time ($8-$12/hr)",
          "Migrate tables, preserving time and orders",
          "Support Billiard, Normal, and La Barra tables",
          "Control Billiard table lights via relay",
          "Manage waiting lists and group assignments",
          "Handle partial time transfers for groups",
          "Require access codes/biometric for all changes",
          "Log all actions in audit logs with CCTV timestamps"
        ]
      },
      {
        "name": "OrderManagement",
        "ui_components": [
          {
            "id": "menu_grid",
            "type": "grid",
            "description": "Food/drink menu with combos",
            "properties": {
              "categories": ["Food", "Drinks", "Specials", "Combos"],
              "items": [
                {
                  "id": "burger",
                  "label": "Burger",
                  "price": 15.00,
                  "modifiers": ["No Onion", "Extra Cheese"]
                },
                {
                  "id": "combo_1",
                  "label": "Burger + Beer + 1hr Billiard",
                  "price": 25.00,
                  "discount": 5.00,
                  "billiard_time": "01:00:00"
                }
              ],
              "button_size": "150x150px"
            }
          },
          {
            "id": "order_summary",
            "type": "list",
            "description": "Current order items, combos, and totals",
            "actions": ["add_item", "apply_combo", "remove_item", "send_to_kds", "apply_discount", "void_item"],
            "requires_access_code": true
          }
        ],
        "dataflow": {
          "entities": ["Order", "Inventory", "Combo", "KDS", "Audit"],
          "processes": [
            {
              "name": "validate_access_code",
              "input": {"user_id": "string", "access_code": "string"},
              "output": {"is_valid": "boolean"}
            },
            {
              "name": "add_order",
              "input": {"table_id": "string", "items": ["item_id", "quantity", "modifiers"]},
              "output": {"order_id": "string", "total": "number"}
            },
            {
              "name": "apply_combo",
              "input": {"table_id": "string", "combo_id": "string"},
              "output": {"order_id": "string", "discount": "number", "billiard_time_credit": "timestamp"}
            },
            {
              "name": "send_to_kds",
              "input": {"order_id": "string"},
              "output": {"kds_status": "pending"}
            },
            {
              "name": "apply_discount_void",
              "input": {"order_id": "string", "type": "discount | void", "reason": "string"},
              "output": {"updated_total": "number"}
            },
            {
              "name": "log_action",
              "input": {"action_type": "string", "employee_id": "string", "details": "object"},
              "output": {"audit_id": "string"}
            }
          ],
          "data_store": {
            "Orders": {
              "fields": ["order_id", "table_id", "items", "combo_id", "total", "status", "discounts_voids"]
            },
            "Inventory": {
              "fields": ["item_id", "name", "stock_level", "reorder_threshold"]
            },
            "Combos": {
              "fields": ["combo_id", "name", "items", "discount", "billiard_time"]
            },
            "KDS": {
              "fields": ["order_id", "table_id", "items", "status", "timestamp"]
            },
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            }
          }
        },
        "functionalities": [
          "Add food/drink orders to any table type",
          "Apply combos with discounts and billiard time credits",
          "Support modifiers and happy hour pricing",
          "Send orders to KDS with real-time updates",
          "Require access codes for discounts, voids, refunds",
          "Log all order changes in audit logs"
        ]
      },
      {
        "name": "Cashier",
        "ui_components": [
          {
            "id": "cashier_screen",
            "type": "dashboard",
            "description": "Handles payments, table assignments, order summaries, and cash reconciliation",
            "properties": {
              "sections": ["table_list", "payment_form", "order_summary", "cash_reconciliation"],
              "table_list": {
                "fields": ["table_id", "table_type", "status", "timer", "order_total"]
              },
              "payment_form": {
                "fields": ["total", "payment_method", "tip", "cash_count"],
                "payment_methods": ["card", "cash", "gift_card"],
                "actions": ["process_payment", "split_bill", "print_receipt", "reconcile_cash"]
              },
              "requires_access_code": true
            }
          }
        ],
        "dataflow": {
          "entities": ["Table", "Order", "Transaction", "Auth", "Audit", "CashReconciliation"],
          "processes": [
            {
              "name": "validate_access_code",
              "input": {"user_id": "string", "access_code": "string"},
              "output": {"is_valid": "boolean"}
            },
            {
              "name": "assign_table",
              "input": {"customer_id": "string", "table_id": "string", "table_type": "string"},
              "output": {"table_status": "occupied", "start_time": "timestamp"}
            },
            {
              "name": "process_payment",
              "input": {"order_id": "string", "amount": "number", "payment_method": "string"},
              "output": {"transaction_id": "string", "status": "completed"}
            },
            {
              "name": "reconcile_cash",
              "input": {"shift_id": "string", "cash_count": "number"},
              "output": {"discrepancy": "number", "alert_sent": "boolean"}
            },
            {
              "name": "log_action",
              "input": {"action_type": "string", "employee_id": "string", "details": "object"},
              "output": {"audit_id": "string"}
            }
          ],
          "data_store": {
            "TableStatus": {
              "fields": ["table_id", "table_type", "status", "start_time", "customer_id", "rental_time"]
            },
            "Orders": {
              "fields": ["order_id", "table_id", "items", "combo_id", "total", "status"]
            },
            "Transactions": {
              "fields": ["transaction_id", "order_id", "amount", "payment_method", "timestamp"]
            },
            "Auth": {
              "fields": ["user_id", "role", "access_code", "biometric_data"]
            },
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            },
            "CashReconciliation": {
              "fields": ["shift_id", "employee_id", "expected_cash", "actual_cash", "discrepancy", "timestamp"]
            }
          }
        },
        "functionalities": [
          "Assign tables from cashier screen",
          "Process payments (EMV, cash, gift card)",
          "Support split billing and tip input",
          "View order summaries for all table types",
          "Reconcile cash drawer at shift end with discrepancy alerts",
          "Require access codes for all actions",
          "Log payments and reconciliations in audit logs"
        ]
      },
      {
        "name": "KitchenDisplaySystem",
        "ui_components": [
          {
            "id": "kds_screen",
            "type": "card_list",
            "description": "Displays orders for kitchen/bar staff",
            "properties": {
              "filters": ["pending", "in_progress", "completed"],
              "order_card": {
                "fields": ["order_id", "table_id", "items", "modifiers", "status"],
                "actions": ["mark_in_progress", "mark_completed", "reject"]
              }
            }
          }
        ],
        "dataflow": {
          "entities": ["Order", "KDS", "Audit"],
          "processes": [
            {
              "name": "receive_order",
              "input": {"order_id": "string", "table_id": "string", "items": "array"},
              "output": {"kds_status": "pending"}
            },
            {
              "name": "update_order_status",
              "input": {"order_id": "string", "status": "string"},
              "output": {"kds_status": "in_progress | completed | rejected"}
            },
            {
              "name": "log_action",
              "input": {"action_type": "string", "employee_id": "string", "details": "object"},
              "output": {"audit_id": "string"}
            }
          ],
          "data_store": {
            "KDS": {
              "fields": ["order_id", "table_id", "items", "status", "timestamp"]
            },
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            }
          }
        },
        "functionalities": [
          "Display orders with table and modifier details",
          "Update order status (Pending, In Progress, Completed, Rejected)",
          "Real-time updates via WebSocket (or IndexedDB offline)",
          "Cache orders for offline operation",
          "Log KDS actions in audit logs"
        ]
      },
      {
        "name": "PaymentProcessing",
        "ui_components": [
          {
            "id": "payment_screen",
            "type": "form",
            "description": "Handles payment input and receipt generation",
            "properties": {
              "fields": ["total", "payment_method", "tip"],
              "payment_methods": ["card", "cash", "gift_card"],
              "actions": ["process_payment", "split_bill", "print_receipt"],
              "requires_access_code": true
            }
          }
        ],
        "dataflow": {
          "entities": ["Transaction", "Order", "Auth", "Audit"],
          "processes": [
            {
              "name": "validate_access_code",
              "input": {"user_id": "string", "access_code": "string"},
              "output": {"is_valid": "boolean"}
            },
            {
              "name": "process_payment",
              "input": {"order_id": "string", "amount": "number", "payment_method": "string"},
              "output": {"transaction_id": "string", "status": "completed"}
            },
            {
              "name": "log_action",
              "input": {"action_type": "string", "employee_id": "string", "details": "object"},
              "output": {"audit_id": "string"}
            }
          ],
          "data_store": {
            "Transactions": {
              "fields": ["transaction_id", "order_id", "amount", "payment_method", "timestamp"]
            },
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            }
          }
        },
        "functionalities": [
          "Process EMV card payments",
          "Support split billing across table types",
          "Generate digital/print receipts with combo details",
          "Require access codes for payment processing",
          "Queue card payments offline",
          "Log payments in audit logs with CCTV timestamps"
        ]
      },
      {
        "name": "ReportingAndAnalytics",
        "ui_components": [
          {
            "id": "report_dashboard",
            "type": "dashboard",
            "description": "Complex reports and analytics with interactive charts",
            "properties": {
              "filters": ["date_range", "table_type", "employee", "report_type"],
              "report_types": ["sales", "table_usage", "inventory", "combo_redemption", "employee_performance", "customer_retention", "audit_logs", "anomaly_detection"],
              "charts": ["bar", "line", "pie"],
              "export_formats": ["PDF", "Excel", "CSV"],
              "analytics": ["trends", "forecasts", "drill_down", "anomaly_alerts"],
              "requires_access_code": true
            }
          },
          {
            "id": "audit_log_screen",
            "type": "table",
            "description": "Audit logs for tracking manipulations",
            "properties": {
              "filters": ["date_range", "employee", "action_type"],
              "columns": ["timestamp", "employee", "action", "details", "ip_address", "cctv_link"],
              "export_formats": ["PDF", "Excel", "CSV"],
              "requires_access_code": true
            }
          }
        ],
        "dataflow": {
          "entities": ["Transaction", "Order", "Inventory", "Combo", "TableStatus", "Auth", "Audit"],
          "processes": [
            {
              "name": "validate_access_code",
              "input": {"user_id": "string", "access_code": "string"},
              "output": {"is_valid": "boolean"}
            },
            {
              "name": "generate_report",
              "input": {"report_type": "string", "date_range": "string", "table_type": "string", "employee_id": "string"},
              "output": {"report_data": "object"}
            },
            {
              "name": "analyze_trends",
              "input": {"report_data": "object", "time_period": "string"},
              "output": {"trend_data": "object"}
            },
            {
              "name": "predict_restock",
              "input": {"inventory_data": "object", "time_period": "string"},
              "output": {"restock_predictions": "object"}
            },
            {
              "name": "detect_anomalies",
              "input": {"audit_data": "object"},
              "output": {"anomalies": "array", "alerts_sent": "boolean"}
            },
            {
              "name": "log_action",
              "input": {"action_type": "string", "employee_id": "string", "details": "object"},
              "output": {"audit_id": "string"}
            }
          ],
          "data_store": {
            "Reports": {
              "fields": ["report_id", "type", "data", "timestamp"]
            },
            "Analytics": {
              "fields": ["analysis_id", "type", "data", "timestamp"]
            },
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            }
          }
        },
        "functionalities": [
          "Generate sales reports by table type, item, time period",
          "Track table usage (utilization rates, peak hours)",
          "Monitor inventory turnover and predict restocking",
          "Analyze combo redemption rates and popularity",
          "Track employee performance (sales, voids, discounts)",
          "Measure customer retention via loyalty program",
          "Support trend analysis and forecasting",
          "Interactive charts with drill-down (Chart.js)",
          "Export reports as PDF/Excel/CSV (cached offline)",
          "Require access codes for report generation",
          "Detect anomalies (e.g., frequent voids) and send alerts",
          "View detailed audit logs with CCTV links"
        ]
      },
      {
        "name": "AntiTheftAndReliability",
        "ui_components": [
          {
            "id": "shift_management",
            "type": "form",
            "description": "Handles shift start/end and cash reconciliation",
            "properties": {
              "fields": ["employee_id", "cash_count"],
              "actions": ["start_shift", "end_shift", "reconcile_cash"],
              "requires_biometric": true
            }
          },
          {
            "id": "alert_dashboard",
            "type": "list",
            "description": "Displays anomaly alerts and discrepancies",
            "properties": {
              "alert_types": ["voids", "discounts", "cash_discrepancy", "inventory_mismatch"],
              "actions": ["view_details", "resolve_alert"]
            }
          }
        ],
        "dataflow": {
          "entities": ["Audit", "CashReconciliation", "Inventory", "Alert"],
          "processes": [
            {
              "name": "shift_start_end",
              "input": {"employee_id": "string", "action": "start | end"},
              "output": {"shift_id": "string"}
            },
            {
              "name": "reconcile_cash",
              "input": {"shift_id": "string", "cash_count": "number"},
              "output": {"discrepancy": "number", "alert_sent": "boolean"}
            },
            {
              "name": "detect_inventory_discrepancy",
              "input": {"item_id": "string", "expected_stock": "number", "actual_stock": "number"},
              "output": {"discrepancy": "number", "alert_sent": "boolean"}
            },
            {
              "name": "integrate_cctv",
              "input": {"action_timestamp": "timestamp"},
              "output": {"cctv_link": "string"}
            },
            {
              "name": "backup_data",
              "input": {"data_type": "string"},
              "output": {"backup_id": "string"}
            }
          ],
          "data_store": {
            "AuditLogs": {
              "fields": ["audit_id", "action_type", "employee_id", "timestamp", "details", "ip_address", "cctv_timestamp"]
            },
            "CashReconciliation": {
              "fields": ["shift_id", "employee_id", "expected_cash", "actual_cash", "discrepancy", "timestamp"]
            },
            "Alerts": {
              "fields": ["alert_id", "type", "details", "timestamp", "resolved"]
            }
          }
        },
        "functionalities": [
          "Automatic data backups and encryption",
          "Error logging and redundancy for reliability",
          "Biometric/PIN login for employee shifts",
          "Cash reconciliation with discrepancy alerts",
          "Inventory discrepancy detection and alerts",
          "Anomaly alerts for suspicious activities (voids, discounts)",
          "CCTV integration for timestamped action videos",
          "Audit logs for all actions with search/export",
          "Manager approvals for sensitive changes",
          "Email/SMS alerts for anomalies and discrepancies"
        ]
      }
    ],
    "integrations": [
      {
        "name": "PaymentGateway",
        "provider": "Stripe",
        "description": "Handles EMV and touchless payments"
      },
      {
        "name": "LightController",
        "provider": "Custom",
        "description": "Controls Billiard table lights via relay"
      },
      {
        "name": "LoyaltyProgram",
        "provider": "Custom",
        "description": "Tracks customer memberships and discounts"
      },
      {
        "name": "CCTVSystem",
        "provider": "Custom",
        "description": "Integrates with CCTV for action timestamps"
      },
      {
        "name": "AlertSystem",
        "provider": "Custom",
        "description": "Sends email/SMS alerts for anomalies"
      },
      {
        "name": "BackupService",
        "provider": "AWS S3",
        "description": "Handles encrypted data backups"
      }
    ]
  }
}
```

## 8. Implementation Notes for Cursor AI
- **Prompt for Cursor AI**:
  ```
  Generate a web-based POS application (PWA) using React (CDN-hosted via cdn.jsdelivr.net) and Node.js for a billiard parlor with bar and restaurant operations. Use the provided JSON skeleton to create:
  - A modern, touch-friendly UI with a dark theme (#1E1E1E, #4CAF50 accents) using Tailwind CSS, deployable on Windows 11 browsers.
  - Modules for Table Management (Billiard, Normal, La Barra tables; migration; timers; light control), Order Management (menu grid, combos, modifiers), Cashier (table assignments, payments, cash reconciliation), Kitchen Display System (KDS for order management), Payment Processing (EMV, split billing), Reporting/Analytics (sales, table usage, inventory, combos, employee performance, customer retention), and Anti-Theft/Reliability (audit logs, anomaly alerts, backups, encryption).
  - Backend APIs (Node.js) for table assignment, migration, order/combo entry, KDS updates, payment processing, complex reporting, audit logging, and anomaly detection.
  - Database schema (IndexedDB for offline, MongoDB for online) for TableStatus, Orders, Inventory, Combos, Transactions, Reports, Analytics, Auth, KDS, AuditLogs, CashReconciliation, Alerts.
  - Offline support using Workbox service workers and IndexedDB to cache table statuses, orders, inventory, combos, reports, and audit logs, with queued transactions (e.g., payments, migrations).
  - Access code/biometric authorization for operations (table assignment, migration, order/combo entry, payments, KDS updates, reports) with role-based access (Manager, Cashier, Kitchen).
  - Robust reporting with customizable filters (date range, table type, employee), interactive Chart.js charts (bar, line, pie), trend analysis, forecasting, anomaly detection, and exports (PDF, Excel, CSV).
  - Anti-theft features: Audit logs with CCTV timestamps, cash reconciliation, inventory discrepancy alerts, manager approvals for voids/discounts, biometric login, anomaly alerts (email/SMS).
  - Reliability features: Automatic backups (AWS S3), data encryption (AES), error logging (Sentry), redundancy (cloud failover).
  - Integrations with Stripe for payments, custom API for light controllers and CCTV, loyalty program for retention, alert system for anomalies.
  - Support table migration (preserve time/orders), three table types, combos (e.g., discounted food + 1hr billiard), KDS, and edge cases (partial time transfers, multi-table groups, combo expiration).
  Ensure the UI is elegant, with large buttons and intuitive flows, optimized for Windows 11 touchscreen browsers.
  ```
- **Expected Output**:
  - **Frontend**: React app with components for table grid, menu, cashier screen (with reconciliation), KDS, payment form, reporting dashboard (Chart.js), and audit log screen, styled with Tailwind CSS.
  - **Backend**: Node.js APIs (e.g., `POST /tables/:id/migrate`, `POST /orders/combo`, `POST /kds/update`, `GET /reports/sales`, `GET /analytics/trends`, `POST /audit/log`, `POST /cash/reconcile`).
  - **Database**: IndexedDB for offline caching, MongoDB for online storage (TableStatus, Orders, Inventory, Combos, Transactions, Reports, Analytics, Auth, KDS, AuditLogs, CashReconciliation, Alerts).
  - **Offline**: Service workers cache UI and data, IndexedDB stores transactions/reports/audits for sync.
- **Testing**: Simulate scenarios (e.g., migrate Billiard 1 to Billiard 2, apply combo, send order to KDS, process payment, reconcile cash, generate sales report, detect void anomaly) in online/offline modes.

## 9. Edge Case Handling
- **Partial Time Transfers**: Split time across tables with access code.
- **Multi-Table Groups**: Link one order to multiple tables, split billing.
- **Combo Expiration**: Track 1-hour billiard credits, expire after session.
- **Access Code Failure**: Prompt re-entry, lock after 3 failures, log in Audit Logs DB.
- **Report Granularity**: Handle large datasets with pagination.
- **Cash Discrepancy**: Alert and log if end-of-shift count doesn't match expected.
- **Inventory Mismatch**: Alert on discrepancies, trigger audit log entry.
- **Anomaly Detection**: e.g., Alert if voids > 5% of sales, integrate with CCTV for review.
- **Backup Failure**: Alert on failed backups, retry mechanism.

## 10. Recommendations
- **UI Design**: Use Figma to refine mockups, importing Visily’s POS template. Ensure cashier and KDS screens are distinct, with reporting dashboard emphasizing interactive charts and audit logs.
- **Development**: Use React with Tailwind CSS for frontend, Node.js for backend, Workbox for offline PWA, Chart.js for analytics, Sentry for error logging, and AES encryption for data.
- **Integrations**: Implement Stripe for EMV payments, custom REST API for light controllers and CCTV, WebSocket for KDS updates, AWS S3 for backups, and email/SMS (Twilio) for alerts.
- **Access Control**: Store hashed access codes/biometric data in MongoDB, support roles (Manager, Cashier, Kitchen), log access attempts in Audit Logs DB.
- **Testing**: Deploy as PWA on Windows 11 (Edge/Chrome), test table migration, combo application, KDS updates, payment processing, cash reconciliation, reporting, and anomaly alerts in online/offline modes.
- **Enhancements**: Add machine learning for advanced anomaly detection, integration with HR systems for employee screening, and compliance with data protection laws (e.g., GDPR for backups).

This updated document provides a complete blueprint for an elegant, user-friendly billiard parlor POS with enhanced reliability, employee control, and anti-theft features. Feed the JSON skeleton into Cursor AI to generate the application, and refine based on staff/customer feedback.