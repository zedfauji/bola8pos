---
phase: 09-auto-updater
plan: "02"
subsystem: infra
tags: [tauri, auto-updater, rust-plugins, capabilities, npm, test-mocks]

requires:
  - phase: 09-auto-updater
    plan: "01"
    provides: Ed25519 pubkey in tauri.conf.json + createUpdaterArtifacts: true

provides:
  - tauri-plugin-updater and tauri-plugin-process registered in Rust builder chain
  - GitHub Releases endpoint wired in tauri.conf.json with passive installMode
  - updater:default and process:allow-relaunch capability grants
  - @tauri-apps/plugin-updater and @tauri-apps/plugin-process npm packages installed
  - Global vi.mock for both plugins in test-setup.ts

affects:
  - 09-03 (React hook useAppUpdater.ts imports check() from @tauri-apps/plugin-updater)
  - 09-04 (UpdateAvailableDialog wired in providers.tsx)
  - 09-05 (E2E tests call mock updater IPC)

tech-stack:
  added:
    - tauri-plugin-updater = "2" (Cargo.toml)
    - tauri-plugin-process = "2" (Cargo.toml)
    - "@tauri-apps/plugin-updater": "^2.10.1" (npm)
    - "@tauri-apps/plugin-process": "^2.3.1" (npm)
  patterns:
    - tauri_plugin_process::init() added to builder chain (no desktop guard needed)
    - tauri_plugin_updater::Builder::new().build() registered inside setup via app.handle().plugin() with #[cfg(desktop)] guard
    - capabilities/default.json grants must explicitly list each plugin permission string
    - Global test mocks in test-setup.ts prevent jsdom failures for Tauri IPC calls

key-files:
  modified:
    - bar-pos/src-tauri/Cargo.toml
    - bar-pos/src-tauri/src/lib.rs
    - bar-pos/src-tauri/tauri.conf.json
    - bar-pos/src-tauri/capabilities/default.json
    - bar-pos/src/shared/lib/test-setup.ts
    - bar-pos/package.json
    - bar-pos/package-lock.json

decisions:
  - "tauri_plugin_process uses builder chain .plugin() — no desktop guard required; tauri_plugin_updater uses app.handle().plugin() inside setup with #[cfg(desktop)] per official docs"
  - "GitHub endpoint is https://github.com/zedfauji/bola8pos/releases/latest/download/latest.json (no git remote configured in repo; URL taken from plan spec)"
  - "installMode passive chosen: no interactive wizard, no UAC escalation, no silent-without-progress (T-9-02-05 mitigated)"
  - "npm installed exact resolved versions: plugin-updater@2.10.1, plugin-process@2.3.1"

metrics:
  duration: "~2min"
  completed: "2026-04-27"
  tasks: 2
  files: 7
---

# Phase 09 Plan 02: Auto-Updater Plugin Wiring Summary

**tauri-plugin-updater and tauri-plugin-process wired into Rust builder, GitHub Releases endpoint configured with passive installMode, JS packages installed, and global jsdom mocks added to test-setup.ts**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-27T19:39:02Z
- **Completed:** 2026-04-27T19:41:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

### Task 1 — Rust plugin dependencies and registration (`3f5439e`)

- `Cargo.toml`: appended `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` to `[dependencies]`, before `[target.'cfg(windows)'.dependencies]`
- `lib.rs`: added `.plugin(tauri_plugin_process::init())` to the `Builder::default()` chain immediately before `.setup()`
- `lib.rs`: added `#[cfg(desktop)] app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;` inside the `.setup()` closure, before `app.manage(config)`

### Task 2 — Config, capabilities, npm packages, test mocks (`06eb0cd`)

- `tauri.conf.json`: extended `plugins.updater` with `endpoints` array (`https://github.com/zedfauji/bola8pos/releases/latest/download/latest.json`) and `windows.installMode = "passive"`; pubkey preserved unchanged
- `capabilities/default.json`: added `"updater:default"` and `"process:allow-relaunch"` to permissions array
- `test-setup.ts`: appended global `vi.mock('@tauri-apps/plugin-updater', ...)` and `vi.mock('@tauri-apps/plugin-process', ...)` at end of file
- `package.json`: installed `@tauri-apps/plugin-updater@^2` (resolved 2.10.1) and `@tauri-apps/plugin-process@^2` (resolved 2.3.1)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Rust plugin deps + registration | `3f5439e` | Cargo.toml, lib.rs |
| 2 | Configure endpoint, capabilities, packages, mocks | `06eb0cd` | tauri.conf.json, default.json, test-setup.ts, package.json, package-lock.json |

## Verification Results

All 10 plan verification checks passed:

1. `grep "tauri-plugin-updater" Cargo.toml` → `tauri-plugin-updater = "2"` ✓
2. `grep "tauri_plugin_updater::Builder" lib.rs` → registration line inside setup ✓
3. `grep "#[cfg(desktop)]" lib.rs` → desktop guard present ✓
4. `grep "endpoints" tauri.conf.json` → GitHub Releases URL (not placeholder) ✓
5. `grep "installMode" tauri.conf.json` → `"passive"` ✓
6. `grep "pubkey" tauri.conf.json` → real base64 pubkey unchanged ✓
7. `grep "updater:default" capabilities/default.json` → present ✓
8. `grep "process:allow-relaunch" capabilities/default.json` → present ✓
9. `grep "@tauri-apps/plugin-updater" package.json` → `"^2.10.1"` ✓
10. `npm run typecheck` → exits 0 ✓

## Deviations from Plan

None — plan executed exactly as written. GitHub endpoint URL `https://github.com/zedfauji/bola8pos/releases/latest/download/latest.json` was specified in the plan prompt and used verbatim (no git remote was configured in the repo).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond those already documented in the plan's threat model. The updater endpoint is a pre-documented trust boundary (T-9-02-01, T-9-02-02).

## Known Stubs

None — this plan contains only configuration and infrastructure wiring; no UI or data stubs.

## Self-Check: PASSED

- `bar-pos/src-tauri/Cargo.toml` has `tauri-plugin-updater = "2"`: confirmed
- `bar-pos/src-tauri/src/lib.rs` has `tauri_plugin_process::init()` and `tauri_plugin_updater::Builder`: confirmed
- `bar-pos/src-tauri/tauri.conf.json` has `endpoints` + `passive` installMode + pubkey unchanged: confirmed
- `bar-pos/src-tauri/capabilities/default.json` has `updater:default` + `process:allow-relaunch`: confirmed
- `bar-pos/src/shared/lib/test-setup.ts` has both vi.mock calls: confirmed
- Task 1 commit `3f5439e` exists: confirmed
- Task 2 commit `06eb0cd` exists: confirmed
- `npm run typecheck` exits 0: confirmed
