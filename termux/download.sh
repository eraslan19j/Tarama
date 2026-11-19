#!/data/data/com.termux/files/usr/bin/bash
# Downloads the Dragon Knight 3D Character Lab to Termux.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
set -a
. "$SCRIPT_DIR/CODES.txt"
set +a

TARGET="${TARAMA_DIR:-$HOME/Tarama}"
DOWNLOAD_CODE_INPUT="${1:-${TARAMA_DOWNLOAD_CODE:-}}"

if [[ -z "$DOWNLOAD_CODE_INPUT" ]]; then
  read -r -p "Download code: " DOWNLOAD_CODE_INPUT
fi

if [[ "$DOWNLOAD_CODE_INPUT" != "$DOWNLOAD_CODE" ]]; then
  echo "Invalid download code." >&2
  echo "Expected: $DOWNLOAD_CODE" >&2
  exit 1
fi

if ! command -v pkg >/dev/null 2>&1; then
  echo "This script is intended for Termux (pkg command not found)." >&2
  exit 1
fi

echo "==> Installing Termux prerequisites"
pkg update -y
pkg install -y git curl nodejs || pkg install -y git curl nodejs-lts

download_with_git() {
  echo "==> Downloading branch $BRANCH with git"
  if [[ -d "$TARGET/.git" ]]; then
    git -C "$TARGET" fetch origin "$BRANCH"
    git -C "$TARGET" checkout "$BRANCH"
    git -C "$TARGET" pull --ff-only origin "$BRANCH"
  else
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$TARGET"
  fi
}

download_with_tarball() {
  echo "==> Git download failed; falling back to a source archive"
  local archive="$HOME/Tarama-source.tar.gz"
  local url="https://codeload.github.com/eraslan19j/Tarama/tar.gz/refs/heads/$BRANCH"
  curl -fL --retry 3 -o "$archive" "$url"
  local root
  root="$(tar -tzf "$archive" | head -n 1 | cut -d/ -f1)"
  if [[ -z "$root" ]]; then
    echo "Could not inspect source archive." >&2
    exit 1
  fi
  tar -xzf "$archive" -C "$HOME"
  if [[ -e "$TARGET" ]]; then
    echo "Existing $TARGET found; leaving it in place and using it."
  else
    mv "$HOME/$root" "$TARGET"
  fi
  rm -f "$archive"
}

if ! download_with_git; then
  download_with_tarball
fi

echo
echo "Download complete: $TARGET"
echo "Activation code: $ACTIVATION_CODE"
echo "Next command:"
echo "  cd \"$TARGET\" && bash termux/activate.sh \"$ACTIVATION_CODE\""
echo
echo "Open http://127.0.0.1:$PORT in your phone browser after activation."
