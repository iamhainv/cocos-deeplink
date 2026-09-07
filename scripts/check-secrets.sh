#!/usr/bin/env bash
#
# check-secrets.sh <dir>
#
# Public pre-commit / CI leak gate for this repository. Scans the working
# tree for secrets and machine-specific artifacts that should never be
# committed: Google API keys, private keys, Firebase/Google Services config
# files, Android keystores, .env files, build-machine absolute paths, and
# AdMob publisher IDs other than Google's own published placeholder values.
#
# This script is standalone and public-safe by design: every pattern below
# is a structural match (a character class describing the *shape* of a
# secret), never a literal secret value, a real ID, or an internal project
# name. It intentionally does not check for anything else — this repo's
# maintainers also run a separate, non-public gate with additional internal
# checks before code reaches this repository at all.
#
# Usage: bash scripts/check-secrets.sh .   (run from the repo root, as CI
# does — see .github/workflows/ci.yml)
#
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: check-secrets.sh <dir>" >&2
  exit 2
fi

if [[ ! -d "$1" ]]; then
  echo "check-secrets.sh: not a directory: $1" >&2
  exit 2
fi

TARGET_DIR="$(cd "$1" && pwd)"

# Resolve this script's own absolute path so the find below can exclude it
# from the scan (SC-2: "exclude itself from its own scan, so it cannot
# self-match"). The patterns in this file are structural, not literal
# secrets, so a self-match would just be noise rather than a real leak —
# but excluding it keeps the gate's output unambiguous.
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

FAIL=0

# ---------------------------------------------------------------------------
# Build the candidate file list: everything under TARGET_DIR except
# node_modules/, .git/, this script itself, and known binary extensions.
# Null-delimited so filenames with odd characters survive.
# ---------------------------------------------------------------------------
FILES_LIST="$(mktemp)"
trap 'rm -f "$FILES_LIST"' EXIT

find "$TARGET_DIR" \
  \( -path '*/node_modules/*' -o -path '*/.git/*' \) -prune -o \
  -type f \
  ! -path "$SELF" \
  ! -name '*.png' ! -name '*.jpg' ! -name '*.jpeg' ! -name '*.webp' ! -name '*.ico' \
  ! -name '*.a' ! -name '*.so' ! -name '*.jar' ! -name '*.aar' \
  ! -name '*.mp3' ! -name '*.ogg' ! -name '*.wav' \
  ! -name '*.ttf' ! -name '*.otf' \
  -print0 > "$FILES_LIST"

scan_pattern() {
  # Runs an ERE pattern across every candidate file, batched through as few
  # grep invocations as xargs needs. -I skips files with NUL bytes (binary
  # content) so vendored binaries are not scanned. $2 is an optional extra
  # grep flag (e.g. "-i").
  [[ -s "$FILES_LIST" ]] || return 0
  xargs -0 grep -InEH ${2:+"$2"} -- "$1" < "$FILES_LIST" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 1. AdMob publisher IDs — deny-by-default. Flag every ca-app-pub-<16 digits>
#    and only allowlist Google's own public values: the shared public test
#    publisher ID (3940256099942544) and the placeholder used in the Mobile
#    Ads SDK's own header docs (0123456789012345).
# ---------------------------------------------------------------------------
hits="$(scan_pattern 'ca-app-pub-[0-9]{16}')"
if [[ -n "$hits" ]]; then
  filtered="$(echo "$hits" | grep -v -E 'ca-app-pub-(3940256099942544|0123456789012345)' || true)"
  if [[ -n "$filtered" ]]; then
    echo "$filtered"
    FAIL=1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Google API keys
# ---------------------------------------------------------------------------
hits="$(scan_pattern 'AIza[0-9A-Za-z_-]{10,}')"
if [[ -n "$hits" ]]; then
  echo "$hits"
  FAIL=1
fi

# ---------------------------------------------------------------------------
# 3. Private keys of any kind
# ---------------------------------------------------------------------------
hits="$(scan_pattern '-----BEGIN [A-Z ]*PRIVATE KEY-----')"
if [[ -n "$hits" ]]; then
  echo "$hits"
  FAIL=1
fi

# ---------------------------------------------------------------------------
# 4. Build-machine absolute paths — leak a contributor's OS username and
#    local directory layout. Matches an absolute path rooted at a home
#    directory, in both its plain form and the JSON-escaped form seen in
#    e.g. xcframework *.abi.json payloads (where each path separator is
#    written as a literal two-character backslash-slash pair, not one).
# ---------------------------------------------------------------------------
hits="$(scan_pattern '(/|\\/)(Users|home)(/|\\/)[A-Za-z0-9_.-]+(/|\\/)')"
if [[ -n "$hits" ]]; then
  echo "$hits"
  FAIL=1
fi

# ---------------------------------------------------------------------------
# 5. Forbidden filenames — config/credential files that should never be
#    committed regardless of their content.
# ---------------------------------------------------------------------------
FORBIDDEN_NAMES=(
  "google-services.json"
  "GoogleService-Info.plist"
  "*.jks"
  ".env"
)

for pattern in "${FORBIDDEN_NAMES[@]}"; do
  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    echo "forbidden file present: $hit"
    FAIL=1
  done < <(find "$TARGET_DIR" \
              \( -path '*/node_modules/*' -o -path '*/.git/*' \) -prune -o \
              -type f -iname "$pattern" -print)
done

if [[ "$FAIL" -ne 0 ]]; then
  echo "" >&2
  echo "check-secrets.sh: FAILED — possible secret or leaked config found in $TARGET_DIR (see above)." >&2
  exit 1
fi

echo "check-secrets.sh: OK — no secrets found in $TARGET_DIR"
exit 0
