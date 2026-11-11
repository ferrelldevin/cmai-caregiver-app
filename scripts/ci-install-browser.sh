#!/usr/bin/env bash
# Installs the browser the CI checks run in, without depending on apt unless it has to.
#
# Why: `npx playwright install --with-deps chromium` always calls apt. On 2026-11-11 the GitHub runner
# could not reach the Ubuntu package servers for hours, apt hung about 10 minutes per attempt, and the
# browser job failed before any check ran. Most of the time the runner image already has every library
# and font Chromium needs, so apt is not needed at all.
#
# What it does:
#   1. Download Chromium itself (from Playwright's own host, not apt).
#   2. Ask Playwright whether the system libraries and fonts are already installed (--dry-run).
#      If yes, stop. Nothing from apt is installed or skipped: the checks run on the same fonts as before.
#   3. If something is missing, install it with apt, but give up after 3 minutes instead of hanging.
set -euo pipefail

npx playwright install chromium

report="$(npx playwright install-deps --dry-run chromium 2>&1 || true)"
echo "$report"
if grep -q "All system dependencies are installed" <<<"$report"; then
  echo "System libraries and fonts for Chromium are already on this runner; skipping apt."
  exit 0
fi

echo "Some system packages are missing; installing them with apt (3 minute limit)."
timeout 180 npx playwright install-deps chromium
