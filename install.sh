#!/usr/bin/env sh
# macOS / Linux entrypoint. Thin wrapper around the cross-platform Node CLI.
#   ./install.sh --all            (or: --core --workers --free-models --extras --hermes)
#   curl -fsSL https://raw.githubusercontent.com/Gildaciolopes/agentic-dev-stack/main/install.sh | sh -s -- --all
set -eu
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js >= 18 is required: https://nodejs.org (or: brew install node / apt install nodejs)" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"
if [ -n "$DIR" ] && [ -f "$DIR/bin/cli.mjs" ]; then
  exec node "$DIR/bin/cli.mjs" install "$@"
fi
exec npx -y agentic-dev-stack@latest install "$@"
