# Table Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem oversees billiard tables, session lifecycles (including the first 10 minutes free), pauses, cleaning modes, tariffs, and advanced features like group management and analytics. It provides precise control over table usage and billing integration.

## Features
- **Table Layout Editor**:
  - **Interactive Floor Plan**: Drag-and-drop interface to position tables on a visual grid or upload a custom floor plan image as background.
  - **Customizable Layouts**: Save multiple layout presets (e.g., "Weekend Setup", "Tournament Mode") for quick reconfiguration.
  - **Table Properties**: Set table dimensions, rotation, and spacing; snap-to-grid and alignment guides for precise placement.
  - **Zones/Areas**: Define sections (e.g., "VIP Area", "Smoking Section") with visual boundaries and custom styling.
  - **Real-time Preview**: See changes instantly with collision detection to prevent overlapping tables.

- **Table CRUD**:
  - **Create Table**: Form with name, group (VIP/Hall), default tariff, capacity (players), and location notes. Validation: Unique names; auto-generate IDs. Explicit: Add images/floor plan positions for visual mapping.
  - **List Tables**: Interactive floor plan view with real-time statuses (color-coded: green available, yellow occupied, blue cleaning); filters by group/status. Support drag-and-drop regrouping directly on the floor plan.
  - **Update Table**: Edit all details; history log for changes. Explicit: Maintenance mode toggle (block usage); rate overrides per table.
  - **Delete Table**: Confirmation with reassignment option for linked sessions/reservations. Edge case: Prevent if active; migrate data automatically.
- **Session Lifecycle**:
  - **Start Session**: Multi-option modal: Select tariff, mode (unlimited/limited with minutes slider), services (checkbox list with prices, e.g., cue rental $5), and player count. Auto-apply free 10min; start timer. Explicit: Guest registration for loyalty points; photo capture for security.
  - **Pause/Resume**: Button with reason input (e.g., "Break"); preserve time and services. Edge case: Max pause limit (30min); auto-resume if exceeded.
  - **Cleaning Mode**: Timer slider (1-15min); auto-badge with countdown and notifications to staff. Explicit: Cleaning checklist (e.g., "Wipe table", "Replace cues"); log completion time.
  - **End Session**: Finalize modal with bill preview (time charges post-free period, services); require PIN. Explicit: Partial end for groups (e.g., end one player); feedback survey.
  - **Transfer/Merge/Split**: Drag-and-drop in floor plan for transfers; merge wizard to combine charges/services; split with proportional allocation. Edge case: Handle uneven splits (manual adjust); prevent merges if time limits conflict.
- **Tariffs**:
  - **CRUD Tariffs**: Form for name, rate, restrictions (days of week, time ranges, e.g., happy hour 5-7 PM $10/h). Explicit: Tiered rates (e.g., first hour $15, subsequent $10); promo codes linkage.
  - **Auto-Application**: Suggest tariffs on start based on time/day; override option with reason.
- **Additional Functionalities**:
  - **Table Groups**: Manage groups with bulk rates/services; analytics per group (usage rates).
  - **Waitlist**: Queue for peak hours; auto-notify when table available.
  - **Analytics**: Usage heatmaps (peak hours), revenue per table, downtime tracking.
- **Edge Cases**:
  - Expired Sessions: Auto-alert with flashing badge; extension option with extra charge.
  - Concurrent Actions: Real-time locking (e.g., "Table in use by Staff Z"); conflict resolution.
  - Offline: Local timer continuation; sync actions on reconnect.
  - Internationalization: Time formats in Spanish; currency in MXN.
  - Security: PIN for all lifecycle changes; log unauthorized attempts.

## Main Page
Clicking on the Table Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard displays a visual floor plan or grid of tables with live statuses, timers, and occupancy indicators; widgets for overall utilization (percentage occupied), revenue summary (daily chart), and waitlist queue. It includes a sidebar for sub-modules (Tables List, Sessions, Tariffs, Groups, Analytics), quick filters (by group/status), and customizable views (e.g., floor plan vs. list). The dashboard is responsive, with dark mode, touch-friendly for tablets, and real-time updates via websockets.

## Endpoints
- `GET /api/tables?group={group}&status={status}&search={name}` (list with filters).
- `POST /api/tables/:id/start` (session with options).
- `POST /api/tables/:id/pause` (pause with reason).
- `POST /api/tables/:id/resume` (resume).
- `POST /api/tables/:id/cleaning` (mode with checklist).
- `POST /api/tables/:id/finalize-bill` (end with survey).
- `GET /api/tariffs?day={day}&time={time}` (list with auto-suggest).
- `POST /api/tables/groups` (manage groups).

## Integrations
- **Order Management Subsystem**: Attach orders to sessions; update charges in real-time.
- **Payment Management Subsystem**: Push finalized sessions to bills.
- **Reservation Subsystem**: Sync bookings to block tables.
- **Access Management Subsystem**: Enforce PIN for lifecycle actions.

## Acceptance Criteria
- Session timers exclude free 10min; pauses preserve accurately.
- Merges/splits handle charges/services without loss.
- Dashboard updates statuses in <1s; floor plan interactive.
- Tariffs apply restrictions correctly (e.g., no weekend rate on weekdays).

## Artifacts
- `pos/frontend/src/subsystems/tables/Dashboard.jsx` (floor plan and widgets).
- `pos/frontend/src/subsystems/tables/LayoutEditor.jsx` (interactive floor plan editor).
- `pos/frontend/src/subsystems/tables/TableList.jsx` (CRUD and groups).
- `pos/frontend/src/subsystems/tables/SessionManager.jsx` (lifecycle controls).
- `pos/frontend/src/subsystems/tables/Tariffs.jsx` (CRUD and analytics).
- `pos/backend/src/subsystems/tables/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/tables/controller.js` (extended logic).
- `pos/backend/src/models/TableLayout.js` (schema for saved layouts).