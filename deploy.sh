#!/bin/bash
set -e

BASE="/home/trackcenter/public_html"

echo "▶ Enter project"
cd "$BASE"

echo "▶ Pull latest code"
git pull origin main || git pull origin master

echo "▶ Installing dependencies"
npm ci

echo "▶ Building app"
npm run build

echo "▶ Restart PM2"
pm2 restart trackcenter.info

echo "✅ Deploy finished successfully"
