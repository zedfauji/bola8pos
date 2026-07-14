# Phase 30: Shared Shell & Primitive Extension - Discussion Log

**Date:** 2026-07-10

## Areas Discussed

### 1. PageContainer backTo/backLabel design
**Options presented:**
- Inside PageContainer header row (Recommended) — inline back button, replaces BackToHomeButton entirely
- Keep BackToHomeButton as-is, add separate backTo prop as independent top-strip element

**User's answer (freeform):** "There should be a back home option providing user an option to go back to home or main nav page in case a server or cashier wants to do anything or attend customer."

**Resolution:** Locked as the Recommended option (inline header placement, replaces BackToHomeButton) — user's framing emphasizes fast, always-visible single-tap access for operational reasons (D-01), which the inline-header design satisfies without adding friction.

### 2. login/home page exemption
**Options presented:**
- Exempt both (Recommended)
- Force both into PageContainer

**User's answer:** Exempt both (Recommended)

**Resolution:** D-02 locked — LoginPage and HomePage stay outside SHELL-01's rollout, explicitly noted as deliberate scope narrowing.

### 3. AppShell/AppNav removal scope
**Options presented:**
- Delete entirely (Recommended)
- Unexport only, keep files

**User's answer:** Delete entirely (Recommended)

**Resolution:** D-03 locked — AppShell.tsx, AppNav/ folder, and their barrel exports removed completely.

### 4. CLAUDE.md routes table fix scope
**Options presented:**
- Routes table only (Recommended)
- Also note PageContainer/back-nav convention

**User's answer:** Routes table only (Recommended)

**Resolution:** D-04 locked — only the routes table rows are corrected; no other CLAUDE.md section touched, and no new convention note added this phase (captured as a deferred idea instead).

## Deferred Ideas

- Replacing `pool-table-status`'s hand-rolled back button with the new PageContainer/backTo pattern — belongs to Phase 31 (COMPONENT-03).
- Documenting the backTo/backLabel convention in CLAUDE.md's Key Conventions — declined for this phase, could be picked up later.

## Claude's Discretion

- Exact prop signature for `backTo`/`backLabel` (string vs object, optional defaults) — left to the planner/researcher to determine from PageContainer's existing prop conventions.
- Whether `pool-table-status` (already on PageContainer) needs a `backTo` value pointing at `/pool-tables` instead of the default `/home` — flagged in canonical_refs/code_context as an integration point to verify, not a locked decision.
