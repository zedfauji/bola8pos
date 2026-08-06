---
created: 2026-08-05T00:00:00.000Z
title: callVoidOrder (and callCloseShift, callGenerateReport) fetch a relative URL — void-order always 404s, never actually voids
area: edge-functions
severity: critical
files:
  - src/shared/lib/edge-function-contracts.ts:794 (callVoidOrder)
  - src/shared/lib/edge-function-contracts.ts:592 (callCloseShift — same pattern, not yet confirmed broken by a live run)
  - src/shared/lib/edge-function-contracts.ts:688 (callGenerateReport — same pattern, not yet confirmed broken by a live run)
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/18-void-order.spec.ts` V2 ("submit
void with reason — success toast and order shows voided state"), traced with a live
Playwright run + browser console capture + direct `fetch()` reproduction (2026-08-05).

`callVoidOrder` (`edge-function-contracts.ts:794`) calls:

```ts
const response = await fetch('/functions/v1/void-order', { ... });
```

— a **relative** URL. This resolves against the calling page's own origin
(`http://localhost:1420` in dev/E2E, and whatever origin the Tauri webview serves
the app from in production), not against the Supabase project. There is no Vite
dev-server proxy rule and no other rewrite for `/functions/v1/*` (confirmed:
`vite.config.ts` has no `proxy` block), so every call 404s:

```
[browser][error] http://localhost:1420/functions/v1/void-order:0 Failed to load
resource: the server responded with a status of 404 (Not Found)
[browser][log] ... [ERROR] order.void.failed {
  "reason": "Test void reason",
  "code": "EDGE_FUNCTION_ERROR",
  "message": "Failed to void order"
}
```

Confirmed this is a pure client-side URL bug, not a deployment gap — the function
itself is live and reachable at the correct absolute URL:

```
$ node -e "fetch('https://<project>.supabase.co/functions/v1/void-order', {method:'OPTIONS'})"
status: 200
body: ok
```

The two sibling functions that DO work correctly (`callProcessPayment`,
`callProcessSplitPayment`, both in the same file) use the right pattern —
`` `${supabaseUrl}/functions/v1/process-payment` `` — reading
`import.meta.env.VITE_SUPABASE_URL` first. `callVoidOrder` never does this.

**Practical effect:** void-order's actual network call can never succeed in any
environment that doesn't happen to reverse-proxy `/functions/v1/*` to Supabase
under the app's own origin. E2E confirms it 404s from the Vite dev server; nothing
in `tauri.conf.json` or elsewhere in this repo sets up such a proxy for the
production Tauri build either, so the same 404 is the likely production behavior
too — void-order (a documented-shipped, money-affecting, irreversible action per
CLAUDE.md's Implemented Features list) may never actually complete server-side via
the UI at all. The client-side UI *looks* functional (dialog opens, reason
validates, confirm button works) right up until the network call, which silently
fails into a `toast.error(...)` — easy to miss in manual testing if the error toast
isn't specifically watched for.

`callCloseShift` (`:592`) and `callGenerateReport` (`:688`) share the exact same
relative-URL pattern in the same file — flagged here as the same root cause, not
independently confirmed broken by a live run in this session (out of this todo's
triage scope; worth checking when this is fixed).

## Solution

Change `callVoidOrder` (and, once independently confirmed, `callCloseShift` /
`callGenerateReport`) to read `import.meta.env.VITE_SUPABASE_URL` and build an
absolute URL, matching `callProcessPayment`'s established pattern in the same
file:

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const response = await fetch(`${supabaseUrl}/functions/v1/void-order`, { ... });
```

Out of scope for Phase 39 (E2E triage, D-03: file real product bugs as todos, don't
fix inline) — `edge-function-contracts.ts` is `src/`, and this plan's prohibitions
explicitly forbid fixing real product bugs inline regardless of how trivial the fix
is.
