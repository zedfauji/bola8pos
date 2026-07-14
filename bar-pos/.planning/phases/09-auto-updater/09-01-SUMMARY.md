---
phase: 09-auto-updater
plan: "01"
subsystem: infra
tags: [tauri, auto-updater, github-actions, ed25519, signing, ci-cd]

requires:
  - phase: 08-polish-reports-e2e-hardening
    provides: stable production codebase ready for release pipeline

provides:
  - Ed25519 public key embedded in tauri.conf.json (plugins.updater.pubkey)
  - createUpdaterArtifacts: true enabling signed .sig sidecar generation
  - .github/workflows/release.yml Windows release pipeline with TAURI_SIGNING_PRIVATE_KEY secret reference and includeUpdaterJson: true
  - Version bumped to 1.1.0 as updater smoke-test baseline

affects:
  - 09-02 (endpoint config adds active.url/interval to plugins.updater)
  - 09-03 (Rust plugin install reads pubkey from tauri.conf.json at verify time)
  - 09-04 (React hook calls check() against published latest.json)
  - 09-05 (E2E tests the full update dialog flow)

tech-stack:
  added: [tauri-plugin-updater (signing infra), GitHub Actions tauri-action@v0]
  patterns:
    - Ed25519 public key lives in tauri.conf.json plugins.updater.pubkey; private key lives ONLY in GitHub Actions secret TAURI_SIGNING_PRIVATE_KEY
    - Release workflow working-directory defaults to bar-pos; tauri-action projectPath: . resolves to bar-pos/src-tauri/tauri.conf.json
    - App version in tauri.conf.json must match git tag (v__VERSION__ substitution) at release time

key-files:
  created:
    - .github/workflows/release.yml
  modified:
    - bar-pos/src-tauri/tauri.conf.json

key-decisions:
  - "Public key stored in tauri.conf.json; private key stored ONLY in GitHub Actions secret — never committed to repo"
  - "createUpdaterArtifacts: true causes tauri-plugin-updater to produce .sig sidecar files alongside installer artifacts"
  - "Version bumped to 1.1.0 (from 1.0.0) to serve as smoke-test baseline — publish release at v1.0.0 tag, run 1.1.0 build against that endpoint to confirm null (no-downgrade guard); publish v1.1.0+ release for real update dialog trigger"
  - "includeUpdaterJson: true on tauri-action step generates latest.json (GitHub Releases asset) consumed by tauri-plugin-updater check()"
  - "working-directory: bar-pos in defaults.run scopes all npm/cargo commands; tauri-action projectPath: . is relative to that working-directory"

patterns-established:
  - "Signing infrastructure pattern: pubkey in config (verifier-side), privkey in CI secret (signer-side) — never the two shall meet in git"
  - "Release tag convention: git tag vX.Y.Z must match version field in tauri.conf.json exactly"

requirements-completed: [UPD-06]

duration: 10min
completed: 2026-04-26
---

# Phase 09 Plan 01: Auto-Updater Signing Infrastructure Summary

**Ed25519 signing key pair wired into tauri.conf.json and GitHub Actions release.yml — public key embedded for artifact verification, private key held exclusively in TAURI_SIGNING_PRIVATE_KEY GitHub secret**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-26T20:20:00Z
- **Completed:** 2026-04-26T20:30:00Z
- **Tasks:** 2 (Task 1: human-action checkpoint; Task 2: auto)
- **Files modified:** 2

## Accomplishments

- Embedded real Ed25519 public key (user-generated) in `tauri.conf.json` under `plugins.updater.pubkey`
- Added `createUpdaterArtifacts: true` to `bundle` block so Tauri produces signed `.sig` sidecars alongside installer artifacts
- Created `.github/workflows/release.yml` with Windows release pipeline: Node LTS, Rust stable, rust-cache, npm ci, tauri-action with `includeUpdaterJson: true` and both signing secret references
- Bumped app version to `1.1.0` as the smoke-test baseline (publish `v1.0.0` release to test no-downgrade; publish `v1.1.0+` to trigger real update dialog)
- Confirmed zero `.key` files in git history (`git log --all --full-history -- "*.key" | wc -l` returns 0)

## Task Commits

1. **Pre-work: .gitignore update** - `976afa4` (chore) — *.key and *.key.pub excluded before key generation
2. **Task 1: Generate Ed25519 signing key pair** — human-action checkpoint; user generated key, saved private key to GitHub secret `TAURI_SIGNING_PRIVATE_KEY`
3. **Task 2: Add pubkey to tauri.conf.json + create release.yml** - `07763de` (feat)

**Plan metadata:** (to be committed with this SUMMARY)

## Files Created/Modified

- `bar-pos/src-tauri/tauri.conf.json` - Added `createUpdaterArtifacts: true`, `plugins.updater.pubkey` with real Ed25519 key, version bumped to 1.1.0
- `.github/workflows/release.yml` - New Windows release pipeline: checkout, node LTS, Rust stable, rust-cache, npm ci, tauri-action with signing secrets and includeUpdaterJson

## Decisions Made

- Public key embedded in config; private key held only in GitHub Actions secret — never committed to git
- `working-directory: bar-pos` in `defaults.run` means `projectPath: .` in tauri-action resolves to `bar-pos/src-tauri/tauri.conf.json`
- Version 1.1.0 used as baseline: publish a `v1.0.0` release to verify the no-downgrade path (check() returns null), then publish `v1.1.0` to trigger the real update dialog
- `releaseDraft: true` so each CI run creates a draft — human reviews before publishing

## Deviations from Plan

None - plan executed exactly as written. Human provided the actual Ed25519 public key at the checkpoint; it was embedded verbatim.

## Issues Encountered

None.

## User Setup Required

**GitHub Actions secrets already configured by user at Task 1 checkpoint:**
- `TAURI_SIGNING_PRIVATE_KEY` — Ed25519 private key (set in GitHub repo Settings → Secrets and variables → Actions)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — set to empty string if no password was used during key generation

**To trigger a release:**
```bash
git tag v1.1.0
git push origin v1.1.0
```
This fires the `publish` workflow which builds, signs, and creates a draft GitHub Release with `latest.json`.

## Next Phase Readiness

- Plan 09-02 can now add `active.url` and `pubkey` endpoint config to `plugins.updater` in `tauri.conf.json`
- Plan 09-03 can install `tauri-plugin-updater` in Rust and wire the `check()` / `download_and_install()` calls — pubkey is already present for signature verification
- Plan 09-04 can implement the React update hook that calls the Tauri command side
- No blockers — signing infrastructure is complete

---
*Phase: 09-auto-updater*
*Completed: 2026-04-26*

## Self-Check: PASSED

- `.github/workflows/release.yml` exists: confirmed
- `bar-pos/src-tauri/tauri.conf.json` has `createUpdaterArtifacts`: confirmed
- `bar-pos/src-tauri/tauri.conf.json` has `plugins.updater.pubkey`: confirmed
- `bar-pos/src-tauri/tauri.conf.json` version is `1.1.0`: confirmed
- Task 2 commit `07763de` exists: confirmed
- Zero `.key` files in git history: confirmed (wc -l returned 0)
