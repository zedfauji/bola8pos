---
phase: 09-auto-updater
verified: 2026-04-26T21:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run 'npm run tauri dev' from bar-pos/. App should launch without a Rust panic or console errors."
    expected: "App boots, DevTools shows zero console errors, no update dialog appears (check() returns null in dev)"
    why_human: "Requires running Tauri desktop process; cannot be verified with static file analysis or unit tests"
  - test: "Open Storybook ('npm run storybook' from bar-pos/) and navigate to 'shared/ui/UpdateAvailableDialog'. Verify all 4 stories render: Default, Downloading, RestartReady, ErrorState."
    expected: "Each story shows the correct state copy, buttons, and progress bar as defined in UI-SPEC.md"
    why_human: "Visual correctness of the 4-state dialog requires human review; static analysis cannot assert rendered appearance"
  - test: "Confirm GitHub repo has TAURI_SIGNING_PRIVATE_KEY secret at Settings → Secrets and variables → Actions."
    expected: "Secret named TAURI_SIGNING_PRIVATE_KEY is listed (value is masked)"
    why_human: "GitHub Secrets are not accessible programmatically from outside CI; requires human navigation of GitHub UI"
  - test: "Push a tag 'v1.1.0' to the repo and check the resulting GitHub Actions run. Confirm the release artifacts include a '.sig' file alongside the installer."
    expected: "Latest release on GitHub has both the installer (.exe/.msi) and a corresponding .sig signature file; latest.json is also present"
    why_human: "Signing of release artifacts can only be confirmed by running the full CI pipeline (tauri-action with TAURI_SIGNING_PRIVATE_KEY); cannot be unit tested"
---

# Phase 9: Auto-Update Service — Verification Report

**Phase Goal:** Ship Tauri-native in-app update detection and one-click install from GitHub Releases. User sees a dialog (version + changelog) at startup and every 4 hours; clicking Install downloads, applies, and restarts without destructive manual steps.
**Verified:** 2026-04-26T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | tauri.conf.json contains a real Ed25519 pubkey, GitHub Releases endpoint, and passive installMode | ✓ VERIFIED | `plugins.updater.pubkey` = real base64 (dW50cnVzdGVk…); `endpoints` = `https://github.com/zedfauji/bola8pos/releases/latest/download/latest.json`; `windows.installMode` = `"passive"` |
| 2 | release.yml produces signed artifacts via TAURI_SIGNING_PRIVATE_KEY secret + includeUpdaterJson: true | ✓ VERIFIED | `.github/workflows/release.yml` line 41: `TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}`; line 49: `includeUpdaterJson: true` |
| 3 | tauri-plugin-updater and tauri-plugin-process registered in Rust (Cargo.toml + lib.rs) | ✓ VERIFIED | `Cargo.toml` lines 30-31: `tauri-plugin-updater = "2"`, `tauri-plugin-process = "2"`; `lib.rs` line 56: `.plugin(tauri_plugin_process::init())`; line 59: `app.handle().plugin(tauri_plugin_updater::Builder::new().build())?` inside `#[cfg(desktop)]` guard |
| 4 | capabilities/default.json grants updater:default and process:allow-relaunch | ✓ VERIFIED | `capabilities/default.json` lines 14-15: `"updater:default"`, `"process:allow-relaunch"` |
| 5 | useAppUpdater hook implements startup check + 4h polling + silent failure + progress + dismiss | ✓ VERIFIED | `useAppUpdater.ts` exports `useAppUpdater` and `UpdaterState`; `FOUR_HOURS_MS = 4 * 60 * 60 * 1000`; `setInterval` with `clearInterval` cleanup; `logger.warn` on error (silent UPD-07); `downloadAndInstall` progress callback (Started/Progress/Finished); `dismissUpdate` resets to idle |
| 6 | UpdateAvailableDialog renders all 4 states correctly with correct copy and no dangerouslySetInnerHTML | ✓ VERIFIED | Component handles `available`, `downloading`, `restart-ready`, `error` phases; `whitespace-pre-wrap` text rendering for changelog; `data-testid="update-dialog-state"` and `data-testid="update-progress"` present; no `dangerouslySetInnerHTML` usage found |
| 7 | UpdaterProvider is mounted in app/providers.tsx — update check starts at app boot | ✓ VERIFIED | `providers.tsx` lines 12-13: imports `useAppUpdater` and `UpdateAvailableDialog`; lines 20-31: `UpdaterProvider` function defined; line 106: `<UpdaterProvider />` in JSX return |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/src-tauri/tauri.conf.json` | Ed25519 pubkey + endpoints + installMode passive | ✓ VERIFIED | Real base64 pubkey, GitHub Releases URL, `"passive"` installMode, `createUpdaterArtifacts: true` |
| `.github/workflows/release.yml` | Windows release pipeline with signing secret + includeUpdaterJson | ✓ VERIFIED | windows-latest runner, TAURI_SIGNING_PRIVATE_KEY + PASSWORD secrets, includeUpdaterJson: true |
| `bar-pos/src-tauri/Cargo.toml` | tauri-plugin-updater + tauri-plugin-process dependencies | ✓ VERIFIED | Both at version "2" |
| `bar-pos/src-tauri/src/lib.rs` | Plugin registration with #[cfg(desktop)] guard for updater | ✓ VERIFIED | `tauri_plugin_process::init()` in builder chain; `tauri_plugin_updater::Builder::new().build()` in setup with `#[cfg(desktop)]` |
| `bar-pos/src-tauri/capabilities/default.json` | updater:default + process:allow-relaunch permissions | ✓ VERIFIED | Both permissions present |
| `bar-pos/src/shared/lib/useAppUpdater.ts` | Hook with UpdaterState union + startup/poll/install/dismiss | ✓ VERIFIED | Exports `useAppUpdater` and `UpdaterState`; 5-phase discriminated union; 116 lines |
| `bar-pos/src/shared/lib/useAppUpdater.test.ts` | 7 unit tests covering UPD-01, 02, 05, 07, 08 | ✓ VERIFIED | 7 `it()` blocks; fake timers; all 5 state transitions covered; 14/14 tests pass per orchestrator |
| `bar-pos/src/shared/ui/UpdateAvailableDialog.tsx` | Four-state dialog with progress bar | ✓ VERIFIED | All 4 states; `data-testid` markers; changelog as plain text; no XSS vector |
| `bar-pos/src/shared/ui/progress.tsx` | shadcn Progress component | ✓ VERIFIED | Uses `@radix-ui/react-progress`; exports `Progress` |
| `bar-pos/src/shared/ui/UpdateAvailableDialog.stories.tsx` | 4 Storybook stories | ✓ VERIFIED | Default, Downloading, RestartReady, ErrorState |
| `bar-pos/src/shared/ui/UpdateAvailableDialog.test.tsx` | 7 RTL tests covering UPD-03, 04, 05, 08 | ✓ VERIFIED | All 7 tests filled with real assertions |
| `bar-pos/src/shared/lib/test-setup.ts` | Global mocks for plugin-updater and plugin-process | ✓ VERIFIED | Lines 81-88: both vi.mock calls present |
| `bar-pos/src/app/providers.tsx` | UpdaterProvider wired into app root | ✓ VERIFIED | Function defined and mounted before `{children}` |
| `bar-pos/e2e/18-updater.spec.ts` | E2E smoke with console-error capture + loginAs | ✓ VERIFIED | `requireIntegrationEnv` guard; console error capture with filter; loginAs auth; dialog absence assertion |
| `bar-pos/src/shared/ui/index.ts` | Exports UpdateAvailableDialog and Progress | ✓ VERIFIED | Lines 56-58 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tauri.conf.json` | tauri-plugin-updater (Rust) | `plugins.updater.pubkey` | ✓ WIRED | Real base64 pubkey present; endpoints array present |
| `release.yml` | GitHub Actions TAURI_SIGNING_PRIVATE_KEY | `${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}` | ✓ WIRED | Secret reference on line 41 |
| `lib.rs` | tauri-plugin-updater (Cargo.toml) | `tauri_plugin_updater::Builder::new().build()` inside `#[cfg(desktop)]` | ✓ WIRED | Lines 58-59 |
| `capabilities/default.json` | @tauri-apps/plugin-updater (JS) | `updater:default` permission | ✓ WIRED | Line 14 |
| `useAppUpdater.ts` | @tauri-apps/plugin-updater | `import { check } from '@tauri-apps/plugin-updater'` | ✓ WIRED | Line 13 |
| `useAppUpdater.ts` | @tauri-apps/plugin-process | `import { relaunch as tauriRelaunch } from '@tauri-apps/plugin-process'` | ✓ WIRED | Line 12 |
| `UpdateAvailableDialog.tsx` | useAppUpdater.ts | `import type { UpdaterState } from '@shared/lib/useAppUpdater'` | ✓ WIRED | Line 10 |
| `providers.tsx` | useAppUpdater.ts | `import { useAppUpdater } from '@shared/lib/useAppUpdater'` | ✓ WIRED | Line 12 |
| `providers.tsx` | UpdateAvailableDialog.tsx | `import { UpdateAvailableDialog } from '@shared/ui'` | ✓ WIRED | Line 13 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `UpdateAvailableDialog.tsx` | `state: UpdaterState` | `useAppUpdater()` hook via `UpdaterProvider` → `check()` from `@tauri-apps/plugin-updater` (IPC) | Yes — real Tauri IPC call to plugin; plugin queries GitHub Releases endpoint | ✓ FLOWING |
| `providers.tsx (UpdaterProvider)` | `state, startInstall, dismissUpdate, relaunch` | `useAppUpdater()` — setInterval check() + event-driven state | Yes — hook calls `check()` on mount and every 4 hours | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for unit/Rust tests — these require a running Tauri desktop process or live GitHub release. The orchestrator confirmed 14/14 unit tests pass. E2E spec (`18-updater.spec.ts`) requires a running dev server and live environment; this is routed to human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UPD-01 | 09-02, 09-03, 09-05 | App detects new version at startup | ✓ SATISFIED | `useAppUpdater` calls `check()` in `useEffect([], [])` (startup); wired into app root via `UpdaterProvider` |
| UPD-02 | 09-03 | Re-checks every 4 hours | ✓ SATISFIED | `setInterval(() => void runCheck(), FOUR_HOURS_MS)` with `clearInterval` cleanup |
| UPD-03 | 09-04 | Dialog shows version + changelog | ✓ SATISFIED | `UpdateAvailableDialog` renders version in Badge + changelog in `whitespace-pre-wrap` ScrollArea |
| UPD-04 | 09-04 | User can confirm install — app downloads, installs, restarts | ✓ SATISFIED (unit) / ? NEEDS HUMAN (full flow) | "Install Now" button calls `onInstall` (verified by test); actual passive NSIS install requires Windows build run |
| UPD-05 | 09-03, 09-04 | User can dismiss / be reminded next startup | ✓ SATISFIED | `dismissUpdate()` resets `state` to `{ phase: 'idle' }`; "Remind Later" button calls `onRemindLater` → `dismissUpdate` |
| UPD-06 | 09-01 | Tauri artifacts signed; key pair generated; GH secret wired | ✓ SATISFIED (code) / ? NEEDS HUMAN (secret + CI run) | `pubkey` embedded in `tauri.conf.json`; `TAURI_SIGNING_PRIVATE_KEY` secret reference in `release.yml`; private key presence in GitHub secret requires human confirmation |
| UPD-07 | 09-02, 09-03 | Graceful no-op on offline/latest version | ✓ SATISFIED | `catch` block in `runCheck` calls `logger.warn` and does NOT update state; `check()` returning `null` leaves state at `idle` |
| UPD-08 | 09-03, 09-04 | Download progress shown | ✓ SATISFIED | `downloadAndInstall` callback handles `Started/Progress/Finished` events; `Progress` component with `data-testid="update-progress"` and `Downloading {percent}%` label |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `UpdateAvailableDialog.tsx` | 99 | Comment mentioning `dangerouslySetInnerHTML` | ℹ️ Info | Comment-only — explains the XSS mitigation rationale. No actual `dangerouslySetInnerHTML` in code. |

No blockers or warnings found. The single info item is a security documentation comment.

### Human Verification Required

#### 1. Tauri Dev Boot Test

**Test:** Run `npm run tauri dev` from `bar-pos/`. Allow the app to fully start.
**Expected:** App launches without a Rust panic message. DevTools (F12) console shows zero errors. No update dialog appears on first boot (check() returns null in the dev environment since no published GitHub release matches the endpoint).
**Why human:** Requires running a Tauri desktop process with WebView2. Cannot be invoked from static analysis or unit tests.

#### 2. Storybook Visual Verification

**Test:** Run `npm run storybook` from `bar-pos/` and navigate to `shared/ui/UpdateAvailableDialog` in the sidebar. Verify each of the 4 exported stories renders correctly.
**Expected:**
- Default: "Update Available" title, version badge, changelog in ScrollArea, "Remind Later" + "Install Now" buttons
- Downloading: "Downloading Update" title, Progress bar at 42%, both buttons disabled
- RestartReady: "Ready to Restart" title, "Later" + "Restart Now" buttons
- ErrorState: "Update Failed" title, "Close" button only
**Why human:** Visual appearance and accessibility cannot be verified by grep or unit tests.

#### 3. GitHub Actions Secret Confirmation

**Test:** Navigate to the GitHub repository → Settings → Secrets and variables → Actions. Confirm `TAURI_SIGNING_PRIVATE_KEY` is listed as a repository secret.
**Expected:** Secret named `TAURI_SIGNING_PRIVATE_KEY` is visible in the list (value is masked). Optionally confirm `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is also present.
**Why human:** GitHub Secrets are not accessible programmatically from outside CI. The orchestrator confirmed `git log --full-history -- "*.key" "*.pem"` returns 0 commits (key not in git history), but the secret's presence in GitHub requires UI confirmation.

#### 4. Release Artifact Signing Verification (optional, pre-release)

**Test:** Push a tag `v1.1.0` to the repository and observe the triggered GitHub Actions `publish` workflow run.
**Expected:** Workflow completes; the draft GitHub Release contains both the Windows installer artifact (`.exe` or `.msi`) and a corresponding `.sig` signature file; `latest.json` is also present as a release asset.
**Why human:** Signing of artifacts only occurs during the tauri-action CI run. Cannot be simulated locally without the private key and full build toolchain.

### Gaps Summary

No automated gaps found. All 7 observable truths are verified in the codebase. The phase goal is architecturally complete: signing infrastructure, Rust plugin registration, JS hook, UI component, and app-root wiring are all present, substantive, and wired.

Four items require human confirmation before the phase can be marked fully closed:
1. Tauri desktop boot (no Rust panic)
2. Storybook visual review (4 states render correctly)
3. GitHub Actions secret present (TAURI_SIGNING_PRIVATE_KEY)
4. Release CI run produces signed artifacts (optional — confirms UPD-06 end-to-end)

Items 1-3 are blocking for a confident `passed` status. Item 4 is pre-release validation.

---

_Verified: 2026-04-26T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
