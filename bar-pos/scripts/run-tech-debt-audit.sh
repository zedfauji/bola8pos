#!/usr/bin/env bash
# scripts/run-tech-debt-audit.sh — Phase 10 tech-debt audit pipeline.
#
# NOTE: `set -uo pipefail` deliberately WITHOUT `-e`. Every tool invoked below
# is expected to exit non-zero when it finds something to report (knip exits 1
# on issues, madge --circular exits 1 on cycles, eslint/vitest/playwright exit
# non-zero on failures). That exit code IS the audit signal, not a script
# failure — do not "fix" this back to `set -e`. Each invocation is suffixed
# with `|| true` so the script always runs every check and writes every report.
set -uo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/.audit-tmp"
mkdir -p "$OUT"

npx knip --reporter json > "$OUT/knip-report.json" || true
npx knip --production --reporter json > "$OUT/knip-production.json" || true

npx jscpd . --reporters json --output "$OUT/jscpd-out" || true

npx madge --circular --json --ts-config tsconfig.json --extensions ts,tsx \
  --exclude '(graphify-out|supabase\.types\.ts|\.stories\.tsx|\.test\.tsx?)$' \
  src > "$OUT/madge-circular.json" || true

echo "Reports written to $OUT"
