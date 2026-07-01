#!/usr/bin/env bash
# Push Caddyfile + install rate_limit plugin on VPS, validate, reload.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-ubuntu@84.54.57.209}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
CADDY_SRC="$ROOT_DIR/infrastructure/caddy/Caddyfile.example"
REMOTE_DIR="/home/ubuntu/leoAI"

echo "=== 1/3 rsync repo (caddy scripts + app code) ==="
rsync -az --exclude ".git" --exclude "node_modules" --exclude ".next" --exclude ".runlogs" \
  -e "ssh -i $SSH_KEY" \
  "$ROOT_DIR/" "$VPS_HOST:$REMOTE_DIR/"

echo "=== 2/3 install caddy-ratelimit if missing ==="
ssh -i "$SSH_KEY" "$VPS_HOST" bash -s <<'REMOTE'
set -euo pipefail
if caddy list-modules 2>/dev/null | grep -q 'http.handlers.rate_limit'; then
  echo "rate_limit module already present"
else
  cd /home/ubuntu/leoAI
  bash ./scripts/dev/install-caddy-ratelimit-vps.sh
fi
REMOTE

echo "=== 3/3 apply Caddyfile + reload ==="
ssh -i "$SSH_KEY" "$VPS_HOST" bash -s <<'REMOTE'
set -euo pipefail
sudo cp /home/ubuntu/leoAI/infrastructure/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl is-active caddy
echo "Caddy OK"
REMOTE

echo "Done."
