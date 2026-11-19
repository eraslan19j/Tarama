#!/data/data/com.termux/files/usr/bin/bash
# Self-contained one-shot Termux installer. Safe to run with: curl ... | bash
set -euo pipefail

DOWNLOAD_CODE="DK3D-2517-TARAMA"
ACTIVATION_CODE="DRAGON-5173-TERMUX"
BRANCH="arena/2b2224d1-tarama"
REPO_URL="https://github.com/eraslan19j/Tarama.git"
PORT="5173"
TARGET="${TARAMA_DIR:-$HOME/Tarama}"

PROVIDED_DOWNLOAD_CODE="${1:-${TARAMA_DOWNLOAD_CODE:-}}"
PROVIDED_ACTIVATION_CODE="${2:-${TARAMA_ACTIVATION_CODE:-$ACTIVATION_CODE}}"

if [[ -z "$PROVIDED_DOWNLOAD_CODE" ]]; then
  read -r -p "Download code: " PROVIDED_DOWNLOAD_CODE
fi

if [[ "$PROVIDED_DOWNLOAD_CODE" != "$DOWNLOAD_CODE" ]]; then
  echo "Invalid download code. Expected: $DOWNLOAD_CODE" >&2
  exit 1
fi

if [[ "$PROVIDED_ACTIVATION_CODE" != "$ACTIVATION_CODE" ]]; then
  echo "Invalid activation code. Expected: $ACTIVATION_CODE" >&2
  exit 1
fi

if ! command -v pkg >/dev/null 2>&1; then
  echo "This installer is intended for Termux." >&2
  exit 1
fi

echo "==> Installing Termux prerequisites"
pkg update -y
pkg install -y git curl nodejs || pkg install -y git curl nodejs-lts

download_with_git() {
  echo "==> Downloading $BRANCH"
  if [[ -d "$TARGET/.git" ]]; then
    git -C "$TARGET" fetch origin "$BRANCH"
    git -C "$TARGET" checkout "$BRANCH"
    git -C "$TARGET" pull --ff-only origin "$BRANCH"
  else
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$TARGET"
  fi
}

download_with_tarball() {
  echo "==> Falling back to source archive"
  local archive="$HOME/Tarama-source.tar.gz"
  curl -fL --retry 3 -o "$archive" \
    "https://codeload.github.com/eraslan19j/Tarama/tar.gz/refs/heads/$BRANCH"
  local root
  root="$(tar -tzf "$archive" | head -n 1 | cut -d/ -f1)"
  tar -xzf "$archive" -C "$HOME"
  if [[ ! -e "$TARGET" ]]; then
    mv "$HOME/$root" "$TARGET"
  fi
  rm -f "$archive"
}

if ! download_with_git; then
  download_with_tarball
fi

echo "==> Activating studio"
cd "$TARGET"
bash termux/activate.sh "$ACTIVATION_CODE"
