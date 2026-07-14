---
phase: 34
slug: visual-regression-baseline
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-14
---

# Phase 34 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| test-runner → local filesystem | Playwright writes baseline PNG snapshots to the local repo tree | Seeded/test-fixture data rendered into screenshots (customer names, in-progress PINs, dollar amounts — no real customer data) |
| local repo → git remote | `.gitignore` is the only gate keeping seeded-data screenshots out of version control | Same as above — must never cross this boundary |
| seed helper (service-role) → Supabase | Test seeding uses `getServiceClient()` / `SUPABASE_SERVICE_ROLE_KEY`, same trust boundary the existing functional E2E suite already crosses | Service-role Supabase credential (env var only, never logged or captured) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-34-01 | Information Disclosure | Baseline PNG snapshots (seeded customer names, in-progress PINs, dollar amounts) | low | mitigate | `.gitignore` entries `e2e-results-visual/` and `e2e/visual/**/*-snapshots/` keep baselines local-only/untracked (D-12). Verified: both patterns present in `.gitignore` (lines 38, 42); `git status --short` confirms zero staged `.png` files. | closed |
| T-34-02 | Tampering | Config isolation between functional and visual Playwright suites | low | mitigate | `testIgnore: /visual\//` on `playwright.config.ts` prevents the functional suite from ever picking up/running the visual spec against the wrong environment. Verified: `playwright.config.ts:18` contains `testIgnore: /visual\//`. | closed |
| T-34-03 | Information Disclosure | Service-role key used for direct Supabase seeding | low | accept | Reuses the existing `e2e/helpers/supabase.ts` `getServiceClient()` path already used by the functional E2E suite — no new key handling, key read only from `SUPABASE_SERVICE_ROLE_KEY` env var, never logged or written into any captured artifact. Verified: `e2e/helpers/supabase.ts:17-22` shows env-var-only read with no logging. | closed |
| T-34-SC | Tampering | npm/pip/cargo installs | low | accept | No packages installed this phase — `@playwright/test@1.59.1` already present in `package.json`; no new install surface introduced. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-34-01 | T-34-03 | Service-role key usage is an unchanged reuse of the existing functional E2E suite's established seeding pattern — no new key-handling surface introduced by this phase. | Planner (PLAN.md threat model) | 2026-07-14 |
| AR-34-02 | T-34-SC | Zero new package installs this phase. | Planner (PLAN.md threat model) | 2026-07-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-14 | 4 | 4 | 0 | Claude (orchestrator, L1 short-circuit — register authored at plan time, ASVS L1, threats_open:0 confirmed via direct grep evidence) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-14
