#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f bridge-test.png chat-input-improved.png react-chat-*.png state-*.png \
      toggle-*.png temp-slider-*.png themes-*.png codedb.snapshot \
      index.playground-chat.js.map
