#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "rg (ripgrep) is required for lint:aicode"
  exit 1
fi

EXCLUDES=(
  --glob '!.git/**'
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!build/**'
  --glob '!.next/**'
  --glob '!.cache/**'
  --glob '!docs/**'
  --glob '!*.md'
  --glob '!scripts/lint-aicode.sh'
)

if rg --pcre2 "${EXCLUDES[@]}" "AICODE-(?!NOTE|TODO|CONTRACT|TRAP|LINK|ASK)" .; then
  echo "❌ Unknown AICODE prefix found."
  exit 1
fi

if rg --pcre2 "${EXCLUDES[@]}" "AICODE-(CONTRACT|TRAP):(?!.*\\[\\d{4}-\\d{2}-\\d{2}\\])" .; then
  echo "❌ AICODE-CONTRACT/TRAP missing [YYYY-MM-DD] date."
  exit 1
fi

echo "✅ AICODE lint passed"
