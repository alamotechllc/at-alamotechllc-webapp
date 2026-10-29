#!/usr/bin/env bash
# Authenticated reference screenshots (Playwright + Firebase emulators).
# Hallmark render tier uses host puppeteer-core; this script captures the signed-in SPA.
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"

OUT_DIR="${REFERENCE_SCREEN_DIR:-evidence/reference-screens}"
mkdir -p "$OUT_DIR"

echo "Reference captures → $OUT_DIR"

firebase emulators:exec --only auth,firestore,storage --project demo-raas-cp \
  "REFERENCE_SCREEN_DIR=$OUT_DIR npx playwright test tests/visual/reference-capture.spec.ts --config playwright.visual.config.ts"
