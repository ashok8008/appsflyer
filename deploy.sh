#!/usr/bin/env bash
#
# Clickvibe Dashboard – Server deploy script
# Place this file at:  ~/public_html/deploy.sh   on the Hetzner server
# Make executable:     chmod +x ~/public_html/deploy.sh
#
# It is invoked by .github/workflows/deploy.yml after each push to main.

set -euo pipefail

APP_DIR="$HOME/public_html"
APP_NAME="clickvibe"
NODE_ENV="production"

echo "==> [$(date -Is)] Starting deploy"
cd "$APP_DIR"

# Load nvm if available (so node/yarn/pm2 are on PATH for non-login shells)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "==> Pulling latest code"
git fetch --all --prune
git reset --hard origin/main

echo "==> Installing dependencies (yarn, frozen lockfile)"
if command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile --production=false
else
  npm ci
fi

echo "==> Building Next.js"
if command -v yarn >/dev/null 2>&1; then
  yarn build
else
  npm run build
fi

echo "==> Restarting PM2 process: $APP_NAME"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  if [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js
  else
    PORT=3000 NODE_ENV=$NODE_ENV pm2 start "node_modules/next/dist/bin/next" \
      --name "$APP_NAME" -- start -p 3000 -H 127.0.0.1
  fi
  pm2 save
fi

echo "==> Pruning old PM2 logs"
pm2 flush "$APP_NAME" >/dev/null 2>&1 || true

echo "==> Deploy completed at $(date -Is)"
pm2 status "$APP_NAME" || true
