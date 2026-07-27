---
created: 2026-07-27T15:01:46.265Z
title: Print popup fallback hangs under Playwright automation
area: testing
severity: major
files:
  - src/shared/lib/pos-printer.ts:25-39 (printReceiptWebFallback)
  - src/shared/lib/pos-printer.ts:96-126 (printRawText)
---

## Problem

`printReceiptWebFallback` and `printRawText` in `pos-printer.ts` are the
browser-mode fallback for thermal receipt/pre-cheque printing (used only when
the app is NOT running inside the real Tauri desktop shell — production
builds use the native `printer.rs` ESC/POS path via `invoke()` and are
unaffected by this).

Both functions open a real popup via `window.open('', '_blank', ...)`, then
`document.write(...)` the receipt/pre-cheque text, then auto-call
`window.print()` in the popup's `onload` handler. Under Playwright/CDP browser
automation, this reproducibly hangs or renders as a blank `about:blank`
window, because `window.print()` opens a native OS print dialog that
Playwright cannot drive or dismiss.

Discovered during Phase 25's Task 4 cross-surface verification walkthrough
(2026-07-27) — not caused by any Phase 25 plan (25-01 through 25-04 never
touch `pos-printer.ts`); Phase 25's automated E2E walkthrough was simply the
first flow to actually click a real print action end-to-end.

Current workaround used for verification purposes: call the underlying
formatting functions (`buildPreChequeText`, `buildThermalReceiptText`)
directly with real data and render the resulting text/HTML for evidence,
bypassing the actual popup+print call. This is not a substitute for real E2E
coverage of the print button itself.

## Solution

TBD. Options to evaluate:
- Replace `document.write()` (already deprecated, flagged with an eslint
  disable) with a `Blob` URL + `w.location.href = blobUrl`, which doesn't
  require `window.print()` to auto-fire and is easier to test.
- Add an in-app preview panel/dialog for pre-cheque (similar to the existing
  post-payment "Receipt" dialog) so the primary UI doesn't depend on a native
  browser popup at all in dev/test contexts, with printing as a separate,
  optional action.
- At minimum, gate `window.print()` behind a config flag or skip it in a
  detected-test-environment so E2E specs can screenshot the popup content
  without triggering a hanging native dialog.
