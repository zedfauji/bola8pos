# Employee Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem handles all HR-like features for staff, including detailed CRUD operations, advanced scheduling, comprehensive performance tracking, payroll integrations, and training modules. It ensures robust staff management, with deep integrations to other subsystems like access control and reporting for a cohesive POS experience.

## Features
- **CRUD Operations**:
  - **Create Employee**: A multi-step wizard form with sections for personal details (name, email, phone), role selection from a dropdown (with previews of permissions), password setup (with strength meter and confirmation), and initial status. Explicit validation: Check for unique email via real-time API call; enforce password policy (at least 8 characters, one uppercase, one number, one symbol); auto-generate temporary password option for new hires. Upon creation, trigger welcome email with login instructions and assign default training modules.
  - **List Employees**: Interactive table with sortable columns (name, role, status, hire date, last login), advanced filters (role, status, hire date range, performance score above/below threshold), and full-text search across name/email/phone. Support for bulk selection with actions like export selected to CSV, assign bulk roles, or send mass notifications. UI: Infinite scrolling for large lists (>100 employees); avatar images with upload support.
  - **Update Employee**: Detailed edit form with tabs for personal info, role and status, performance history, and schedule preferences. Require manager PIN for critical changes like role or status; display change history log inline. Explicit functionalities: Update password with old password verification; add custom fields (e.g., emergency contact, allergies for bar staff); integrate photo upload with cropping tool.
  - **Delete Employee**: Confirmation modal with options for soft delete (set status to inactive, retain data for reports) or hard delete (anonymize and remove, only if no historical data). Prevent deletion if employee has open shifts or unresolved payments; provide migration option to transfer data to another employee. Edge case: Automatically revoke access tokens and log out all sessions; archive performance metrics to a separate audit collection.
- **Scheduling**:
  - **Shift Assignment**: Full-featured calendar interface supporting weekly/monthly views, drag-and-drop for shifts, color-coding by role (e.g., blue for cashiers, green for kitchen), and auto-suggestions based on preferences and availability. Explicit: Conflict detection with pop-up resolutions (e.g., "Overlap with Employee X – Swap?"); recurring shifts (e.g., every Monday 9-5); shift templates for common patterns.
  - **Notifications and Reminders**: Automated email/SMS for shift assignments, changes, or reminders (24h/1h before start). Support custom templates (e.g., include location, uniform requirements). Edge case: Handle undeliverable notifications with fallback to in-app alerts; track read receipts.
  - **Bulk Scheduling**: Upload CSV or Excel for mass assignments; visual preview before apply. Validation: Auto-detect overlaps across all employees; suggest optimizations (e.g., balance workloads).
  - **Time-Off Requests**: Employee self-service portal for requesting vacation/sick leave; manager approval workflow with notifications and calendar blocking. Explicit: Integrate with payroll for paid/unpaid tracking; report on approval rates.
- **Performance Tracking**:
  - **Metric Collection**: Real-time dashboards showing sales processed (daily/weekly charts), tables managed (heatmaps by peak hours), tips earned (comparison to team average), and custom KPIs (e.g., order accuracy rate from KDS feedback).
  - **Reviews and Feedback**: Quarterly review form with rating scales (1-5 stars per category like punctuality, customer service), free-text comments, and goal setting. Support 360-degree feedback (peer reviews). Edge case: Anonymous submissions; auto-generate performance reports for HR compliance.
  - **Incentives**: Auto-calculate bonuses based on metrics (e.g., $50 for top salesperson); track achievements with badges (e.g., "Perfect Attendance").
  - **Trends Analysis**: Line graphs for metric trends over time; predictive alerts (e.g., "Declining sales – suggest training").
- **Payroll Integration**:
  - **Hours Calculation**: Automatic tally from schedules and clock-in/out (integrate with time clock feature); support overtime detection per Mexican labor laws (e.g., double pay after 8h).
  - **Tip Distribution**: Configurable rules (e.g., pool tips by shift, split 70/30 front/back house); manual adjustments with audit trail.
  - **Export and Sync**: Generate payroll-ready CSV/XML; one-click sync with external tools like QuickBooks or Contpaqi. Edge case: Handle disputes with review logs; support tax withholdings preview.
- **Training Module**:
  - **Course Assignment**: Library of courses (e.g., "POS Basics", "Food Safety"); assign by role with deadlines. Track progress with percentages.
  - **Interactive Quizzes**: Multiple-choice, true/false, or scenario-based questions; auto-grading with explanations. Explicit: Video embeds for tutorials; certificate generation upon 80% pass.
  - **Compliance Tracking**: Mandatory courses for new hires; reminders for expirations (e.g., annual refreshers). Edge case: Retake limits (3 attempts); integrate with performance reviews.
- **Additional Functionalities**:
  - **Clock-In/Out**: Biometric or PIN-based time tracking; geo-fencing to ensure on-site.
  - **Employee Portal**: Self-service for viewing schedules, requesting swaps, updating personal info.
  - **Analytics**: Subsystem-wide reports like turnover rate, average tenure, cost per employee.
- **Edge Cases**:
  - Concurrent Edits: Real-time collaboration with locking (e.g., "Employee being edited by Manager Y").
  - Inactive Employees: Automated cleanup (e.g., archive after 6 months inactive); retain for legal hold.
  - Bulk Actions: Rate limiting to prevent abuse; transaction rollback on failures.
  - Internationalization: Support Spanish/English for forms and notifications.
  - Security: Encrypt sensitive data like passwords; GDPR-like consent for personal info.

## Main Page
Clicking on the Employee Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard serves as the entry point, featuring a customizable layout with widgets for key metrics (e.g., active employees count, upcoming shifts summary, low-performance alerts). It includes a sidebar for quick navigation to sub-modules (List, Schedules, Performance, Training, Analytics), a search bar for global employee lookup, and role-based views (e.g., managers see full analytics, employees see personal portal). The dashboard is responsive, with dark mode support and accessibility features like keyboard navigation.

## Endpoints
- `GET /api/employees?role={role}&status={status}&search={query}&sort={field}&page={number}` (advanced list with pagination and sorting).
- `POST /api/employees` (create with wizard payload).
- `PUT /api/employees/:id` (update with partial data and PIN verification).
- `DELETE /api/employees/:id` (soft/hard delete with options).
- `POST /api/employees/:id/schedule` (add/update shift with conflict check).
- `GET /api/employees/performance?from={date}&to={date}&employee={id}` (detailed metrics and trends).
- `POST /api/employees/training/assign` (assign courses).
- `GET /api/employees/analytics` (subsystem reports like turnover).

## Integrations
- **Access Management Subsystem**: Automatically sync role changes to update permissions and PIN requirements.
- **Shift Management Subsystem**: Feed schedules into shift opening/closing; track clock-in for accuracy.
- **Reporting Subsystem**: Provide performance data for employee-specific reports and dashboards.
- **Order/Payment Subsystems**: Attribute sales/tips to employees for real-time metric updates.
- **Reservation Subsystem**: Assign staff to event bookings based on schedules.

## Acceptance Criteria
- Employee creation triggers welcome notification and reflects in dashboard widgets instantly.
- Scheduling detects and resolves conflicts; bulk import handles 500+ shifts without errors.
- Performance trends update after simulated actions (e.g., complete a sale increments metrics).
- Training completion generates certificate; quizzes grade accurately with feedback.
- Subsystem dashboard loads <2s; navigation between sub-modules seamless without full reloads.

## Artifacts
- `pos/frontend/src/subsystems/employees/Dashboard.jsx` (main subsystem entry with widgets).
- `pos/frontend/src/subsystems/employees/EmployeeList.jsx` (advanced table and bulk actions).
- `pos/frontend/src/subsystems/employees/Scheduler.jsx` (calendar with drag-and-drop).
- `pos/frontend/src/subsystems/employees/PerformanceTracker.jsx` (charts and reviews).
- `pos/frontend/src/subsystems/employees/TrainingModule.jsx` (courses and quizzes).
- `pos/backend/src/subsystems/employees/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/employees/controller.js` (extended logic with integrations).