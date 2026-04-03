#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

APP_DIR="$CLAUDE_PROJECT_DIR/yawp-firebase"

echo "Installing npm dependencies in $APP_DIR..."
cd "$APP_DIR"
npm install

echo "Dependencies installed successfully."
