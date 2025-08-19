# Access Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem manages role-based access control (RBAC), PIN enforcement, audit trails, session handling, and security policies, providing granular security across the POS. It includes advanced logging, anomaly detection, and compliance tools for robust protection.

## Features
- **Role-Based Access Control (RBAC)**:
  - **CRUD Roles**: Detailed form for creating roles with a permission matrix (checkbox grid by module/action, e.g., tables:start, orders:void). Preview impacted employees before save. Explicit: Import/export role templates as JSON; role inheritance (e.g., manager extends cashier).
  - **Assign Roles**: Bulk assignment interface with employee search and preview of permission changes. Auto-apply to sessions. Edge case: Scheduled role changes (e.g., temporary promotion for a shift).
  - **Permission Enforcement**: Server-side checks on every API call; UI dynamically hides/disables buttons based on roles. Explicit: Custom permission scripting for complex rules (e.g., "cashiers can void < $20").
- **PIN Enforcement**:
  - **Configuration**: Settings page for PIN rules per action (e.g., always for voids, threshold for payouts). Support dynamic thresholds (e.g., based on bill total).
  - **Modal and Validation**: Customizable PIN modal with numeric keypad UI, retry counter, and timeout. Explicit: Biometric fallback option (if device supports); log all attempts.
  - **Lockouts and Resets**: Auto-lock after 3 failures (configurable duration); admin reset with verification. Edge case: Emergency override code for critical situations.
- **Audit Trails**:
  - **Logging**: Auto-capture all actions with context (user, IP, device, before/after state). Support custom log levels (info, warn, error).
  - **Viewer and Analysis**: Advanced search with facets (user, action, time, module); timeline view for user activity. Explicit: Export with filters to CSV/PDF; anomaly detection (e.g., flag unusual patterns like multiple voids).
  - **Alerts**: Real-time notifications for high-risk events (e.g., setting change); email digests for daily summaries.
- **Session Management**:
  - **Active Sessions**: List all logged-in sessions with details (device, location, last active); bulk logout.
  - **Idle and Timeout**: Configurable idle period (e.g., 10min warning, 15min logout); extend on user interaction.
  - **Multi-Device**: Limit concurrent sessions per user; force single sign-in option.
- **Additional Functionalities**:
  - **Security Policies**: Define policies like password rotation (every 90 days), two-factor auth setup.
  - **Compliance Reports**: Generate audit reports for legal requirements (e.g., data access logs for privacy laws).
  - **Anomaly Detection**: AI-assisted flagging of suspicious activity (e.g., login from new location).
- **Edge Cases**:
  - Permission Conflicts: Resolve with priority rules (e.g., deny overrides allow); simulate permissions in UI tester.
  - Offline: Buffer logs locally; sync with timestamp conflict resolution.
  - Bulk Operations: Rate limit to prevent abuse; rollback on partial failures.
  - Internationalization: Multi-language support for logs and modals (Spanish/English).
  - Security: Encrypt logs in transit; role-based access to audit viewer.

## Main Page
Clicking on the Access Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard provides an overview with widgets for active sessions count, recent audits summary (chart of actions by type), role distribution pie, and security alerts (e.g., recent lockouts). It includes a sidebar for navigation to sub-modules (Roles, Audit Logs, Sessions, Policies, Analytics), a global search for logs/users, and customizable views (e.g., admin sees full logs, auditors see read-only). The dashboard is responsive, with dark mode and accessibility enhancements like voice-over support.

## Endpoints
- `GET /api/roles?search={query}&module={module}` (list with advanced filters).
- `POST /api/roles` (create with permission matrix).
- `PUT /api/roles/:id` (update with inheritance).
- `DELETE /api/roles/:id` (delete with impact check).
- `GET /api/audit_logs?user={id}&action={type}&from={date}&to={date}&facets={true}` (search with facets).
- `POST /api/access/verify-pin` (validate with context).
- `GET /api/sessions/active?user={id}` (list sessions).
- `POST /api/sessions/logout` (bulk logout).

## Integrations
- **Employee Management Subsystem**: Sync role assignments and trigger updates on employee changes.
- **All Subsystems**: Embed permission checks in APIs and UI; log actions from other modules.
- **Settings Subsystem**: Pull and apply security configs like PIN thresholds.
- **Reporting Subsystem**: Feed audit data for security reports.

## Acceptance Criteria
- Role changes propagate to block unauthorized actions across subsystems.
- Audit viewer searches and exports large logs (>10k entries) efficiently.
- PIN lockout triggers after failures; resets work as configured.
- Session management logs out idle users; multi-device limits enforced.

## Artifacts
- `pos/frontend/src/subsystems/access/Dashboard.jsx` (overview with widgets).
- `pos/frontend/src/subsystems/access/RoleManager.jsx` (CRUD with matrix).
- `pos/frontend/src/subsystems/access/AuditViewer.jsx` (search and analysis).
- `pos/frontend/src/subsystems/access/SessionManager.jsx` (active sessions control).
- `pos/backend/src/subsystems/access/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/access/controller.js` (extended logic).