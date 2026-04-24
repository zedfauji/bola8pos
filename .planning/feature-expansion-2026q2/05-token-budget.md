---
title: Token Budget Detail
status: reference
---

# Token Budget Detail

Estimates based on existing feature sizings in the Bola8 POS codebase. A comparable feature (`add-item-to-tab`) costs ~25k tokens end-to-end including tests and iterations.

## Per-sprint breakdown

| Sprint | Planning | Implementation | Test authoring | Debug/deviation | Total |
|---|---|---|---|---|---|
| S1 Foundation | 8k | 35k | 15k | 12k | **70k ± 10k** |
| S2 Combos | 15k | 90k | 35k | 20k | **160k ± 20k** |
| S3a Ingredients | 10k | 50k | 25k | 10k | **95k ± 15k** |
| S3b Recipes | 12k | 70k | 35k | 13k | **130k ± 20k** |
| S3c Prep+Cocktails | 10k | 50k | 25k | 10k | **95k ± 15k** |
| S4 Split+Refund | 15k | 95k | 45k | 20k | **175k ± 25k** |
| S5 Waitlist | 12k | 70k | 35k | 13k | **140k ± 20k** |
| S6 Polish+Reports | 8k | 50k | 20k | 12k | **90k ± 20k** |

**Base total: ~955k ± 145k**

## Model routing (cost optimization)

Match the existing sprint-runner profile:

| Agent | Model | Use |
|---|---|---|
| PM orchestrator | Haiku 4.5 | Ticket decomposition, sequencing — cheap |
| Planner | Opus 4.7 | Phase planning, goal-backward verification |
| Developer | Sonnet 4.6 | Bulk implementation |
| Tester | Sonnet 4.6 | Test authoring, failure analysis |
| Verifier | Opus 4.7 (1M) | Cross-cutting verification, integration checks |

## With deviation buffer

Add 30% for real-world deviation (failed tests, scope clarifications, debug loops):

- **Base**: 955k
- **+30% buffer**: ~1.24M
- **Round up for safety**: **~1.4M tokens total budget**

## Cost signals to watch

Stop and re-plan if:
- A single sprint exceeds 2× its estimated token budget — scope creep or wrong abstraction
- Test authoring exceeds implementation cost — usually means the code is hard to test (refactor first)
- Verifier consistently flags the same goal unmet — planning gap, not execution gap

## Checkpoint strategy

Commit at ticket granularity (existing GSD protocol). Context reset after each sprint. Use `/gsd:pause-work` mid-sprint only if context is genuinely saturated.
