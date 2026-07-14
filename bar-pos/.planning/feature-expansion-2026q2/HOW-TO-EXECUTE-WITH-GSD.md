---
title: How to Execute This Milestone with GSD
status: playbook
audience: operator (you)
---

# How to Execute This Milestone with GSD

Step-by-step playbook for taking the 8 sprint docs in `sprints/` from "planned" to "shipped" using GSD. Written specifically for this milestone — not a generic GSD tutorial.

> Command prefix convention in your install is `/gsd:` (colon). Upstream docs show `/gsd-` (hyphen). Both map to the same commands. This doc uses the colon form your install surfaces.

---

## 0. Before you run anything

### One-time setup check

Verify GSD is wired up and pointing at this project:

```
/gsd:health
```

This runs the diagnostic. If it reports issues, let it auto-repair before continuing. Don't proceed if health is red.

### Pick your profile

```
/gsd:set-profile balanced
```

Recommended for this milestone: `balanced` (Sonnet for bulk, Opus for planning/verify). If you're cost-constrained, `budget` works for S1/S3a/S3c (lower-risk sprints) but **keep balanced or quality for S2, S3b, S4** — those are the plans most likely to go wrong if under-planned.

### Confirm the milestone is visible to GSD

```
/gsd:progress
```

GSD should surface the current project state. If it doesn't see "Feature Expansion 2026Q2" as an active milestone, register it:

```
/gsd:new-milestone
```

Then in the questions it asks, point it at this roadmap file: `.planning/feature-expansion-2026q2/README.md`. Answer its PROJECT.md refresh questions by referencing the locked decisions doc.

### Map the codebase once (if not already done)

If `.planning/codebase/` is empty or stale:

```
/gsd:map-codebase
```

This produces `STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `CONCERNS.md` — reference documents that every planner + executor reads. Saves token cost on every subsequent sprint because agents don't re-explore.

Only run once. Re-run at the end of the milestone (after S6) to refresh for the next project.

---

## 1. The per-sprint loop

Run this full cycle for each sprint, in order: **S1 → S2 → S3a → S3b → S3c → S4 → S5 → S6**.

> S5 can technically start in parallel with S3a–c after S1 ships (see §3). For single-operator execution, run sequential.

### Step 1.1 — Discuss the phase (lock assumptions)

```
/gsd:discuss-phase S1
```

GSD asks questions. **For this milestone, save time by setting assumptions mode:**

```
/gsd:settings
# Set workflow.discuss_mode = 'assumptions'
```

In assumptions mode, GSD reads the sprint doc + codebase, generates a list of assumptions, and asks you to confirm/correct. Faster because every sprint doc already has decisions locked.

When it asks open questions, answer by **pointing at the sprint file**: "See `sprints/S1-foundation.md` § Scope" rather than re-explaining.

Produces: `CONTEXT.md` with numbered decisions `D-01`, `D-02`, ...

### Step 1.2 — Plan the phase

```
/gsd:plan-phase S1
```

This triggers:
1. **4 parallel researcher agents** — stack, features, architecture, pitfalls
2. **Planner agent** — consumes RESEARCH.md + your sprint doc + CONTEXT.md → writes PLAN.md files (one per plan)
3. **Plan-checker** — goal-backward verification, loops up to 3× if issues

**What to watch for:** the plan-checker enforces that every ticket in the sprint doc's ticket table becomes a task with a verify command. If a sprint doc has 15 tickets, the PLAN should reference 15 tickets. If you see fewer, push back before execution.

**Nyquist validation layer** will also write `VALIDATION.md` mapping each sprint requirement to a test command. Confirm it references:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npx playwright test e2e/<sprint-spec>.spec.ts`

If validation is gappy, run:

```
/gsd:list-phase-assumptions S1
```

This surfaces Claude's assumptions; you can correct them before execution.

### Step 1.3 — UI phase (only for UI-heavy sprints)

Run for: **S2, S3c, S4, S5, S6**. Skip for S1, S3a, S3b (infra/data).

```
/gsd:ui-phase S2
```

Produces `UI-SPEC.md` locking the design contract (spacing, color, typography) against your shadcn components. This prevents the "5 combo widgets built slightly differently" problem.

### Step 1.4 — Execute the phase

```
/gsd:execute-phase S1
```

This runs wave-based parallel execution:
- Executor agents take independent tickets in parallel (fresh 200K context each)
- Atomic commits per ticket with conventional-commit messages
- Wave 2 waits for Wave 1 dependencies
- Verifier runs after all waves → writes `VERIFICATION.md`

**While it runs, you:**
- Do not interrupt unless a commit is wrong
- Watch for repeated verification failures on the same task — that's a planning gap, not an execution gap (see §4 Troubleshooting)
- Respond to any deviation requests GSD surfaces

### Step 1.5 — Verify the work (manual UAT)

```
/gsd:verify-work
```

GSD walks you through conversational UAT keyed to the sprint doc's **Definition of Done** checklist. Check each box as you go.

For this milestone, always run the manual Tauri smoke test at this step:

```bash
cd bar-pos
npm run tauri dev
```

and click through the primary flows in the sprint doc's `04-navigation-ui-flows.md` section.

### Step 1.6 — Close Nyquist gaps (if any)

If `/gsd:verify-work` flags missing automated coverage for a requirement:

```
/gsd:add-tests S1
```

This runs the nyquist-auditor agent to generate + run tests until coverage is compliant.

### Step 1.7 — Commit, tag, advance

GSD commits atomically as it works. At sprint completion, nothing extra required. Move to the next sprint's §1.1.

---

## 2. Complete execution order for this milestone

Run these in sequence. **Don't skip ahead.** The dependency chain is real: S3a's ledger is trusted by S3b's depletion; S3b's reversal contract is called by S4's refund.

```
# Once:
/gsd:health
/gsd:set-profile balanced
/gsd:map-codebase                       # only if not done
/gsd:new-milestone                      # register Feature Expansion 2026Q2
/gsd:settings                           # set discuss_mode = 'assumptions'

# Per sprint — repeat for S1 through S6:
/gsd:discuss-phase <id>
/gsd:plan-phase <id>
/gsd:ui-phase <id>                      # skip for S1, S3a, S3b
/gsd:execute-phase <id>
/gsd:verify-work
/gsd:add-tests <id>                     # only if verify flagged gaps

# At milestone end:
/gsd:audit-milestone
/gsd:complete-milestone
```

Sprint IDs to pass: `S1`, `S2`, `S3a`, `S3b`, `S3c`, `S4`, `S5`, `S6`.
(If GSD demands numeric IDs, use `1, 2, 3.1, 3.2, 3.3, 4, 5, 6`.)

---

## 3. When to use which ancillary command

| Command | When in this milestone |
|---|---|
| `/gsd:pause-work` | End of day mid-sprint. Preserves context for resumption. Don't use between sprints — natural break. |
| `/gsd:resume-work` | Start of next session after pause-work. |
| `/gsd:progress` | "Where am I?" status check. Safe to run any time. |
| `/gsd:debug` | When an execution bug resists a single fix attempt. Creates a persistent debug session across context resets. Useful for the recipe depletion integration in S3b if it goes sideways. |
| `/gsd:quick "task"` | **Skip for this milestone.** Quick tasks bypass the plan-check gate — not worth it when you have detailed sprint docs already. |
| `/gsd:insert-phase` | If mid-milestone you need urgent work (e.g. production bug). Creates decimal phase like 3.4 without renumbering. |
| `/gsd:add-todo` | Capture a paper-cut during a sprint without breaking flow. Picked up in S6. |
| `/gsd:check-todos` | At start of S6, pull in all accumulated paper-cuts. |
| `/gsd:validate-phase N` | If S6 audit reveals a phase shipped without Nyquist coverage. |
| `/gsd:cleanup` | After milestone complete. Archives old phase directories. |

---

## 4. Troubleshooting — milestone-specific failure modes

### "Plan-check keeps failing with 'missing verify command'"

The Nyquist layer wants every task to have an automated check. Sprint docs already list test commands in each § Testing section. The planner may not have picked them up. Fix:

```
/gsd:list-phase-assumptions <sprint>
```

Correct the assumption list to include: `npm run test -- <path>`, `npx playwright test e2e/<spec>.ts` as the verify commands for each ticket.

### "Plan references fewer tickets than the sprint doc"

The planner consolidated work. This is **not acceptable for this milestone** — the sprint docs were written at the right granularity for review + atomic commits. Reject the plan:

```
/gsd:plan-phase <sprint> --replan
```

If `--replan` isn't supported in your GSD version, delete `PLAN.md` in the phase dir and re-run `/gsd:plan-phase`.

### "Executor hits a schema migration conflict"

Symptoms: migration fails locally because a previous sprint's migration wasn't fully applied. Cause: you jumped ahead or local DB is behind staging.

Fix:
```bash
cd bar-pos
npx supabase db reset   # local only — DESTRUCTIVE
# or manually run pending migrations in order
```
Then resume with `/gsd:resume-work`.

### "Verifier says goal not met but tests pass"

Planning gap, not execution gap. The Definition of Done in the sprint doc was more stringent than the plan's success criteria. Don't force verification to pass. Instead:

```
/gsd:add-phase
```

Add a small sub-phase covering the gap. Better than pretending it's done.

### "Token cost is way over budget for a sprint"

See §5 below. Stop and replan.

### "S3b depletion is silently wrong in integration"

This is the highest-risk failure mode in this milestone. If P6 property test passes but end-to-end orders don't deplete ingredients:

```
/gsd:debug
```

Start a debug session. Most likely cause: edge function ordering — depletion running before order insertion commits. Fix by moving depletion into the same transaction (not post-commit trigger).

### "WasenderAPI edge function can't read the Vault secret"

Check:
```bash
supabase secrets list
```
Verify `WASENDER_API_KEY` is listed. If missing:
```bash
supabase secrets set WASENDER_API_KEY=<value>
```
Redeploy edge function. This blocks S5 completion but not earlier sprints.

---

## 5. Cost & pacing — don't fly blind

Per `05-token-budget.md`, the milestone is budgeted at ~1.4M tokens. Check after each sprint:

```
/gsd:progress
```

If a sprint overshoots its per-sprint estimate by **>2×**, stop:

1. Open the sprint's `PLAN.md` files
2. Look for: ambitious scope creep, missing abstraction, or over-ambitious ticket granularity
3. Use `/gsd:pause-work`, then re-discuss the sprint with tighter scope

Historical signal: S2 (combos) and S4 (split+refund) are the highest-risk for cost overrun. S1, S3a, S5, S6 should come in on-budget.

### Between-sprint checkpoint protocol

After every sprint's `/gsd:verify-work` passes:

1. Note the token spend in this table:
   ```
   S1: actual __ / budget 70k
   S2: actual __ / budget 160k
   ...
   ```
2. If 2 consecutive sprints overshoot >1.5×, the later sprints need rescoping — run `/gsd:discuss-phase` on the next sprint with scope tightening in mind.
3. Merge / push the sprint's commits. GSD will not push for you.

---

## 6. Parallelism — when it's safe to break the sequence

Sequential is safest but slow. Safe parallel windows:

- **After S1 ships:** S5 (waitlist) has no data dependency on S3a/b/c. If you want to parallelize, start S5 after S1 in a second worktree using `/gsd:workstreams create waitlist` (or manual worktree). Keep S3 sequential.
- **After S3b ships:** S3c and S4 can run in parallel — neither depends on the other.

**Do not parallelize:**
- S1 before anything
- S3a / S3b / S3c (strict sequence — ledger must be trusted before recipes; recipes before prep)
- S2 and S3b (both mutate `order_items` insertion path; merge conflicts likely)

If parallelizing, use worktrees:
```
/gsd:workstreams create waitlist-parallel
```
Each worktree has isolated `.planning/` state.

---

## 7. End of milestone

After S6 verifies clean:

```
/gsd:audit-milestone
```

This checks milestone completion against the original intent in this README + locked decisions. Writes an audit report. If gaps surface:

```
/gsd:plan-milestone-gaps
```

to close them.

When the audit is clean:

```
/gsd:complete-milestone
```

This archives `.planning/feature-expansion-2026q2/` phase directories, updates PROJECT.md, and readies the repo for the next milestone. After it runs, update CLAUDE.md's "Implemented Features" list manually (S6-13 has this as a DoD item — should already be done).

Then reflect the state in Obsidian:
- Update `ObsidianVault/Bola8 POS/Feature Backlog & Roadmap.md` — move shipped items to "Already Implemented"
- Archive the local Obsidian `Feature Expansion 2026Q2/` folder or leave for history

---

## 8. Session discipline

Rules that save you from re-work:

1. **One sprint per session minimum unless paused cleanly.** Don't jump mid-sprint to another task — use `/gsd:pause-work`.
2. **Context reset between sprints.** After `/gsd:verify-work` on sprint N, start a fresh Claude session for sprint N+1. GSD's state survives resets. Context savings are significant.
3. **Never run `/gsd:quick`** in this milestone. The sprint docs ARE the plan; quick-path skips the plan-check gate you need.
4. **Never run with `--no-verify` on git.** Pre-commit hooks catch the things the verifier misses.
5. **Commit frequency is GSD's job.** You don't commit manually during a sprint; GSD does it atomically per ticket. If you find yourself `git add`ing, something's wrong.
6. **Read `VERIFICATION.md` after every sprint.** It's the canonical record of what GSD believes shipped. If it's wrong, fix it before moving on.

---

## 9. Minimal happy-path example (S1 walkthrough)

Concrete session for your first sprint:

```
# New Claude session
/gsd:progress
# → GSD says "Feature Expansion 2026Q2 active, next: S1"

/gsd:discuss-phase S1
# → Assumptions mode lists assumed decisions from sprint doc
# → You confirm or correct
# → CONTEXT.md written

/gsd:plan-phase S1
# → 4 researchers run in parallel (~5 min)
# → Planner writes 3–5 PLAN.md files (one per logical group of tickets)
# → Plan-checker verifies (may loop twice)
# → You approve

/gsd:execute-phase S1
# → Wave 1: S1-01 (stock_movements rename), S1-02 (category tree), S1-03 (modifier groups), S1-04 (combo flags), S1-05 (payments drop) — parallel migrations
# → Wave 2: S1-06 (type regen) — depends on all migrations
# → Wave 3: S1-07, S1-08, S1-09, S1-10 — UI work in parallel
# → Wave 4: S1-11, S1-12, S1-13 — RLS + tests
# → Verifier runs, writes VERIFICATION.md

/gsd:verify-work
# → Walks DoD checklist from sprint doc
# → You run `npm run tauri dev` and click through Settings → Categories
# → Mark each DoD box checked

# Session end. Fresh session for S2.
```

---

## 10. Quick-reference cheatsheet

```
START NEW SESSION
  /gsd:progress                → where am I?

BEGIN A SPRINT
  /gsd:discuss-phase <id>      → lock decisions
  /gsd:plan-phase <id>         → generate PLAN.md
  /gsd:ui-phase <id>           → (if UI-heavy)
  /gsd:execute-phase <id>      → build it
  /gsd:verify-work             → manual UAT
  /gsd:add-tests <id>          → (if coverage gaps)

MID-SPRINT ISSUES
  /gsd:debug                   → persistent bug session
  /gsd:pause-work              → end day cleanly
  /gsd:resume-work             → next day
  /gsd:add-todo "..."          → paper-cut to S6

MILESTONE END
  /gsd:audit-milestone
  /gsd:complete-milestone
  /gsd:cleanup
```

That's the loop. Eight iterations and you're done.
