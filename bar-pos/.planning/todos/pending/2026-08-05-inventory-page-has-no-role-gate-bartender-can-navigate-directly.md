---
created: 2026-08-05T00:00:00.000Z
title: /inventory page has no role gate at all — bartender navigating directly gets full page, no redirect, no blocking dialog
area: rbac
severity: major
files:
  - src/app/router.tsx:75-81 (/inventory route)
  - src/pages/inventory/index.tsx
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/21-product-management.spec.ts` PM8
("bartender navigating to product management — button absent or PIN gate shown"),
traced with a live run + source read (2026-08-05). This is one of two
access-control findings this plan's threat model (T-39-14) required an explicit
written verdict on — **the gate does NOT hold.**

`/inventory`'s route registration (`router.tsx:75-81`) wraps `InventoryPage` in
only the generic `<ProtectedRoute>` (authentication check), the same as every
other route — unlike `/settings`, `/reports` (`ReportsRoute`), `/kds`
(`KdsRoute`), and `/audit` (`AuditRoute`), which each get a dedicated
role-gating wrapper per CLAUDE.md's own Routes table (CLAUDE.md documents
"Inventory page requires `adjust_inventory` (manager+)" as the intended rule, but
no code enforces it at the route or page level).

`InventoryPageInner` (`pages/inventory/index.tsx`) calls `canAccess(role,
'adjust_inventory')` exactly once, to gate only the "Physical Count" button
(`canPhysicalCount`). Nothing else on the page checks role. Confirmed live: a
bartender navigating directly to `/inventory` is NOT redirected to `/home` and
sees NO "manager access required" (or similar) blocking dialog — the full page
renders immediately with the stock table, low-stock alerts, and (per the related
todo `2026-08-04-inventory-quantity-controls-not-rbac-disabled-for-bartender.md`)
individually-unguarded quantity +/- controls per row.

This is broader than that related todo describes: that todo scoped the gap to
"the +/- controls aren't disabled," but PM8's evidence shows there is **no
page-level gate whatsoever** — a bartender can view the entire inventory page
(stock levels, thresholds, alert state) with zero access-control friction, not
just interact with individually-unguarded controls once on the page.

Confirmed not a server-side data-integrity hole (the write path is still
RLS-protected per the related todo's finding on `inventory_update_manager_admin`)
— this is a client-side visibility/access-control gap: CLAUDE.md documents
`adjust_inventory` as manager+, but nothing enforces "who can even open this
page" the way `/settings`/`/reports`/`/kds`/`/audit` do.

## Solution

TBD. Options to evaluate:
- Add a dedicated route-level gate (matching `ReportsRoute`/`KdsRoute`/
  `AuditRoute`'s existing pattern) wrapping `/inventory`, redirecting
  non-manager+ roles to `/home` or showing a blocking "manager access required"
  dialog — matching what `/settings` already does for bartender.
- Coordinate with `2026-08-04-inventory-quantity-controls-not-rbac-disabled-for-
  bartender.md` — a page-level gate would make that todo's narrower fix
  unnecessary (a bartender who can't reach the page can't see the unguarded
  controls either), so these two todos likely resolve together.
