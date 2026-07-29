---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-07-29T04:16:30.587Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 26 | unrun-verify | e2e/04-pool-timer.spec.ts |  | E2E pool-timer spec not run to a pass/fail verdict for Plan 26-02 — Playwright's managed dev server returned net::ERR_CONNECTION_REFUSED on both attempts before any page loaded (dev-server/environment issue, typecheck/lint/unit-test all green). | open |  | 2026-07-29T04:16:30.587Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "e2e/04-pool-timer.spec.ts",
    "line": null,
    "description": "E2E pool-timer spec not run to a pass/fail verdict for Plan 26-02 — Playwright's managed dev server returned net::ERR_CONNECTION_REFUSED on both attempts before any page loaded (dev-server/environment issue, typecheck/lint/unit-test all green).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-29T04:16:30.587Z",
    "resolved_at": null
  }
]
````
