# Reporting — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem delivers comprehensive reports on sales, inventory, employees, anomalies, and custom queries, with visualizations, exports, and scheduled deliveries for data-driven decisions.

## Features
- **Report Types**:
  - **Sales Reports**: Detailed breakdowns by period (shift/day/month/year), payment methods, stations, items. Explicit: Comparative views (vs. last period); drill-down to individual bills.
  - **Inventory Reports**: Movements history, wastage analysis, COGS calculations, supplier performance. Explicit: Trend forecasting (e.g., stock out predictions); variance reports (expected vs. actual).
  - **Employee Reports**: Performance scorecards, tip distributions, shift efficiencies. Explicit: Ranking leaderboards; absenteeism tracking.
  - **Anomaly Reports**: Detection of irregularities (e.g., high voids, unusual sales spikes); customizable thresholds.
  - **Custom Reports**: Builder with drag-and-drop fields, filters, and groupings; save templates.
- **Visualizations**:
  - **Charts and Graphs**: Interactive line/bar/pie (e.g., sales trends, category shares); zoom/pan support.
  - **Tables and Heatmaps**: Pivot tables with sorting, grouping, and conditional formatting (e.g., red for negative variances).
  - **Dashboards**: Customizable with widgets; shareable links.
- **Exports and Delivery**:
  - **Formats**: CSV, PDF, Excel; scheduled emails (daily/weekly summaries).
  - **Print**: Optimized layouts with headers/footers; batch printing.
  - Explicit: Data masking for sensitive info (e.g., anonymize employees in exports).
- **Additional Functionalities**:
  - **Scheduled Reports**: Cron-like setup for auto-generation and delivery.
  - **Alerts**: Threshold-based (e.g., sales drop >20%); integrate with notifications.
  - **Data Export Audit**: Log all exports for compliance.
- **Edge Cases**:
  - Empty Datasets: Guided messages (e.g., "No sales yet – Check filters?"); placeholder charts.
  - Large Data: Lazy loading, aggregation for >1M records; export streaming.
  - Offline: Cache recent reports; queue custom queries.
  - Internationalization: Localized dates/currency; Spanish translations.
  - Security: RBAC for report access; watermark on sensitive exports.

## Main Page
Clicking on the Reporting entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard aggregates key reports in widgets (e.g., today's sales chart, inventory alerts, employee top performers), with a report builder interface and saved templates list. It includes a sidebar for sub-modules (Sales, Inventory, Employees, Anomalies, Custom, Schedules), quick filters (date presets, modules), and export center. The dashboard is responsive, with dark mode, interactive charts, and user-specific views (e.g., managers see full data).

## Endpoints
- `GET /api/reports/sales?from={date}&to={date}&breakdown={method}` (sales with drills).
- `GET /api/reports/inventory?from={date}&to={date}&type={cogs}` (inventory details).
- `GET /api/reports/employees?from={date}&to={date}&metric={sales}` (performance).
- `GET /api/reports/anomalies?threshold={zscore}` (flags).
- `POST /api/reports/custom` (builder query).
- `POST /api/reports/schedule` (setup auto-reports).

## Integrations
- **All Subsystems**: Pull aggregated data (e.g., sales from payments).
- **Access Management Subsystem**: RBAC for report views/exports.
- **Settings Subsystem**: Apply formats and thresholds.

## Acceptance Criteria
- Reports generate accurately; visuals interactive.
- Custom builder saves/runs templates; exports complete.
- Scheduled reports deliver on time; anomalies flag correctly.

## Artifacts
- `pos/frontend/src/subsystems/reporting/Dashboard.jsx` (widgets and builder).
- `pos/frontend/src/subsystems/reporting/SalesReports.jsx` (breakdowns and charts).
- `pos/frontend/src/subsystems/reporting/InventoryReports.jsx` (movements and forecasts).
- `pos/frontend/src/subsystems/reporting/EmployeeReports.jsx` (scorecards).
- `pos/backend/src/subsystems/reporting/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/reporting/controller.js` (extended logic).