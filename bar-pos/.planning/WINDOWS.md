---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-08-02T19:44:06.125Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 26 | unrun-verify | e2e/04-pool-timer.spec.ts |  | E2E pool-timer spec not run to a pass/fail verdict for Plan 26-02 — Playwright's managed dev server returned net::ERR_CONNECTION_REFUSED on both attempts before any page loaded (dev-server/environment issue, typecheck/lint/unit-test all green). | open |  | 2026-07-29T04:16:30.587Z |  |
| 2 | 26 | unrun-verify | e2e/04-pool-timer.spec.ts |  | Plan 26-04 verification item 6 (npx playwright test e2e/04-pool-timer.spec.ts) and item 7 (deactivate-floating-resource.integration.test.ts) not re-run to completion — severe host filesystem/process contention during execution. Also: ~15 e2e specs (incl. this one, e2e/helpers/supabase.ts) still query .from('pool_tables'), the table Plan 01 renamed to resources — likely breaks these specs at the DB level regardless of dev-server health. | open |  | 2026-07-29T06:56:28.946Z |  |
| 3 | 28 | deviation | src/features/process-refund/process-refund-rpc.integration.test.ts |  | Flaky/pre-existing integration test failure (parent-close trigger) observed during 28-06 verify — unrelated to money-formatter changes, likely cross-worktree DB race; see phase deferred-items.md | open |  | 2026-08-02T19:44:06.125Z |  |

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
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "e2e/04-pool-timer.spec.ts",
    "line": null,
    "description": "Plan 26-04 verification item 6 (npx playwright test e2e/04-pool-timer.spec.ts) and item 7 (deactivate-floating-resource.integration.test.ts) not re-run to completion — severe host filesystem/process contention during execution. Also: ~15 e2e specs (incl. this one, e2e/helpers/supabase.ts) still query .from('pool_tables'), the table Plan 01 renamed to resources — likely breaks these specs at the DB level regardless of dev-server health.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-29T06:56:28.946Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "28",
    "file": "src/features/process-refund/process-refund-rpc.integration.test.ts",
    "line": null,
    "description": "Flaky/pre-existing integration test failure (parent-close trigger) observed during 28-06 verify — unrelated to money-formatter changes, likely cross-worktree DB race; see phase deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-02T19:44:06.125Z",
    "resolved_at": null
  }
]
````
