---
sprint: S6
title: Polish + Reports + E2E Hardening
duration: 2 weeks
tokens: 90k ± 20k
depends_on: [S2, S3b, S3c, S4, S5]
unlocks: []
status: blocked_on_previous
---

# S6 — Polish, Reports, Hardening

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Ship operator-facing analytics for the features built in S2–S5, fix paper-cuts surfaced during S1–S5 field use, harden the E2E suite, and resolve any deferred debt. This sprint turns infrastructure into a product.

## Scope

### In
1. Reports: Combo Mix, Recipe Variance, Waitlist Analytics, Refunds Register
2. Reporting DB views (defined in 02-data-model.md § S6)
3. Combo sales dashboard tile on ReportsPage
4. Recipe variance report (theoretical vs physical)
5. Waitlist analytics (avg quoted vs actual wait, no-show rate)
6. Refunds register (daily total refunds, by reason, by operator)
7. Performance indexes applied (see data-model § S6)
8. E2E hardening: fix any flaky specs from S1–S5, add missing coverage gaps found during sprints
9. Paper-cuts backlog from previous sprints (reserve ~30% of sprint for field feedback)
10. Documentation pass: update CLAUDE.md "Implemented Features" list; update Obsidian Feature Backlog & Roadmap

### Out
- New features (holdovers go to next milestone)

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S6-01 | Migration: reporting views (combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily) | migration | M |
| S6-02 | Migration: performance indexes | migration | S |
| S6-03 | Widget: ComboMixReport | `src/widgets/ComboMixReport/` | M |
| S6-04 | Widget: RecipeVarianceReport | widget | M |
| S6-05 | Widget: WaitlistAnalyticsReport | widget | M |
| S6-06 | Widget: RefundsRegister | widget | M |
| S6-07 | ReportsPage tab reorganization | page | S |
| S6-08 | CSV export for all new reports | feature helpers | M |
| S6-09 | Combo availability override report (who overrode, when) | widget | S |
| S6-10 | E2E `25-reports.spec.ts` | e2e | M |
| S6-11 | Flakiness sweep on specs 18–24 | e2e | M |
| S6-12 | Paper-cut backlog (reserve) | various | L |
| S6-13 | CLAUDE.md update: implemented features section | CLAUDE.md | XS |
| S6-14 | Obsidian update: mark roadmap items done | vault | XS |
| S6-15 | Migration audit: ensure all migrations have DOWN scripts | review | S |

## Reports — specifications

### Combo Mix Report
```
Filters: date range, combo category
Columns:
  combo_name | units_sold | gross_revenue | avg_price | override_count (day-of-week overrides)
Chart: stacked bar (day-of-week × combo_name) for last 30 days
```

### Recipe Variance Report
```
Filters: date range, ingredient category
Columns:
  ingredient | theoretical_used (from ledger 'sale' rows) | physical_count_delta | variance % | cost_impact
Highlights: rows with variance > ±10% in red
```

### Waitlist Analytics
```
Filters: date range
Metrics:
  parties seated, no-show rate, avg quoted wait, avg actual wait,
  quoted-vs-actual gap, notification channel mix (whatsapp vs manager)
Chart: hourly heatmap of queue length
```

### Refunds Register
```
Filters: date range, operator, reason
Columns: date | operator | tab | items | amount | reason | restock_flag | manager_who_approved
Totals row at bottom
```

## Performance indexes
See [02-data-model.md § S6](../02-data-model.md).

Verify after migration:
```sql
EXPLAIN ANALYZE SELECT * FROM stock_movements WHERE ingredient_id = :x ORDER BY ts DESC LIMIT 50;
-- must use index scan, <5ms on 100k rows
```

## Paper-cut backlog (reserve slots)

Track during S1–S5. Fill this section as feedback surfaces. Expected categories:
- Touch-target sizing on tablet
- Focus-trap bugs in Sheet components
- Loading skeleton coverage
- Error toast copy consistency
- Report export encoding
- Combo card layout at varying product name lengths
- Realtime reconnection edge cases

## Testing

### E2E `25-reports.spec.ts`
1. Seed representative data: 7 days of combo sales, mixed recipes with variance, waitlist entries notified + seated, refunds
2. Admin opens ReportsPage
3. Verify each new report renders with non-zero data
4. Export CSV for each → validate file contents
5. Filter by date range → data recomputed
6. Check combo override list shows expected entries

### Regression gate
`npm run test:e2e` must pass end-to-end with all 25 specs. Any flaky spec fixed or quarantined with explicit reason.

### Performance gate
Report queries must complete in <500ms on 6 months of seed data. Fail sprint if not.

## Definition of Done

- [ ] All reporting views created and indexed
- [ ] 4 new report widgets render correctly with seed data
- [ ] CSV export works for each report
- [ ] E2E `25-reports.spec.ts` green
- [ ] Full E2E suite (01–25) green with no skipped specs
- [ ] Paper-cut backlog resolved (or explicitly deferred with ticket)
- [ ] CLAUDE.md "Implemented Features" updated with dates
- [ ] Obsidian "Feature Backlog & Roadmap" updated
- [ ] Performance gate met (<500ms queries)
- [ ] All migrations reversible (DOWN scripts verified)
- [ ] typecheck + lint clean

## Risks

| Risk | Mitigation |
|---|---|
| Reserve time consumed by paper-cuts | If >50% of sprint consumed by cuts, defer one report to next milestone |
| Reporting queries slow on production data volumes | Indexes + materialized views if needed (add to next milestone, don't invent here) |
| Flaky specs require deep rework | Box-time per spec (2h); if unresolved, quarantine with issue tag and ship |

## Notes

- Resist scope-creep into new features. If a customer asks for something during S6 demo, log it for the next milestone.
- This is the "make it feel solid" sprint. Treat polish as first-class work, not filler.
