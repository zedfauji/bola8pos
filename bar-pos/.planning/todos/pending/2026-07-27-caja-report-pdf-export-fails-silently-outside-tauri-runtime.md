---
created: 2026-07-27T15:01:46.265Z
title: Caja Report PDF export fails silently outside Tauri runtime
area: testing
severity: major
files:
  - src/features/*/useExportReport.ts (Caja Report PDF export handler)
  - src/shared/lib/exporters/pdf.tsx (cajaReportToPdfBytes — unaffected, produces correct bytes)
---

## Problem

The in-app Caja Report "Export > PDF" button calls
`@tauri-apps/plugin-dialog`'s `save()` and `@tauri-apps/plugin-fs`'s
`writeFile()`, both of which require the real Tauri desktop runtime. When the
app is served via plain `npm run dev` / Playwright browser-mode (no Tauri
shell — the normal way to run E2E tests on Ubuntu per this repo's own
CLAUDE.md), clicking Export > PDF fails in the browser console
(`export.report.failed {type: "caja-pdf"}` from `useExportReport.ts`'s catch
block) with no user-visible error — the failure is silent from the user's
perspective (a localized es-MX toast is shown but doesn't clearly indicate
what happened or how to recover).

Discovered during Phase 25's Task 4 cross-surface verification walkthrough
(2026-07-27) — not caused by Phase 25 (25-01 through 25-04 only changed what
PDF content `cajaReportToPdfBytes()` produces — the category grouping — never
the file-save delivery mechanism, which is confirmed working correctly; this
is purely about the save/export step being untestable outside Tauri).

Workaround used for verification: called `cajaReportToPdfBytes()` directly
with real data from a live `get_caja_report` RPC call, bypassing only the
Tauri `save()` dialog step, to produce faithful PDF evidence.

## Solution

TBD. Options to evaluate:
- Add a browser-mode fallback (e.g. build a `Blob` and trigger a download via
  a temporary `<a>` anchor tag) so PDF export works in local dev / E2E without
  Tauri, in addition to the native save dialog in production.
- At minimum, surface a clearer, non-localized-only error/toast when export
  fails so at least it's an intentional "not available in dev mode" message
  rather than a silent console-only failure.
- Alternatively, explicitly document that Caja Report PDF export is
  Tauri-only and cannot be E2E-tested outside `npm run tauri dev`, and add a
  `test.skip` guard with that rationale to whatever E2E coverage attempts it.
