#!/data/data/com.termux/files/usr/bin/bash
# Activates the downloaded project: installs dependencies and starts the live 3D studio.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck disable=SC1091
set -a
. "$SCRIPT_DIR/CODES.txt"
set +a

ACTIVATION_CODE_INPUT="${1:-${TARAMA_ACTIVATION_CODE:-}}"

if [[ -z "$ACTIVATION_CODE_INPUT" ]]; then
  read -r -p "Activation code: " ACTIVATION_CODE_INPUT
fi

if [[ "$ACTIVATION_CODE_INPUT" != "$ACTIVATION_CODE" ]]; then
  echo "Invalid activation code." >&2
  echo "Expected: $ACTIVATION_CODE" >&2
  exit 1
fi

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "==> Node.js is missing; installing it"
  pkg install -y nodejs || pkg install -y nodejs-lts
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm could not be installed." >&2
  exit 1
fi

echo "==> Node $(node --version), npm $(npm --version)"
echo "==> Installing project dependencies"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock >/dev/null 2>&1 || true
fi

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=1536"

echo
echo "Dragon Knight studio activated."
echo "Open: http://127.0.0.1:$PORT"
echo "Press Ctrl+C to stop the server."
echo

npm run dev -- --port "$PORT"
