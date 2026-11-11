#!/usr/bin/env bash
set -u

echo 'Local development:'
for tool in bun uv python3; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo "  $tool: $($tool --version)"
  else
    echo "  $tool: missing"
  fi
done
echo "  Expected Bun: $(bun -p 'require("./package.json").packageManager' 2>/dev/null || echo 'see package.json')"
echo "  Expected Python: $(cat .python-version)"
echo 'Docker and browser acceptance:'
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo '  Docker engine: available'
else
  echo '  Docker engine: unavailable (install Docker and start its engine)'
fi
echo '  Chromium: install with bunx playwright install chromium'
if command -v surreal >/dev/null 2>&1; then
  echo "  SurrealDB: $(surreal version) (native tests use 3.3.4)"
else
  echo '  SurrealDB: missing (native tests use 3.3.4)'
fi
