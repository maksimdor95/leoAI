#!/usr/bin/env bash
# On VPS: build Caddy with github.com/mholt/caddy-ratelimit and install to /usr/bin/caddy.
# Run on server: bash ./scripts/dev/install-caddy-ratelimit-vps.sh
set -euo pipefail

GO_VERSION="${GO_VERSION:-1.22.5}"
GO_ROOT="/usr/local/go"
export PATH="$GO_ROOT/bin:$HOME/go/bin:$PATH"

if ! command -v go >/dev/null 2>&1 || ! go version | grep -qE 'go1\.(2[2-9]|[3-9][0-9])'; then
  echo "Installing Go ${GO_VERSION}..."
  tmp="$(mktemp -d)"
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o "$tmp/go.tgz"
  sudo rm -rf "$GO_ROOT"
  sudo tar -C /usr/local -xzf "$tmp/go.tgz"
  rm -rf "$tmp"
  export PATH="$GO_ROOT/bin:$PATH"
fi

echo "Installing xcaddy..."
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

BUILD_DIR="$(mktemp -d)"
cd "$BUILD_DIR"
echo "Building Caddy with caddy-ratelimit in $BUILD_DIR ..."
xcaddy build v2.11.2 --with github.com/mholt/caddy-ratelimit

if ! ./caddy list-modules 2>/dev/null | grep -q 'http.handlers.rate_limit'; then
  echo "Build succeeded but rate_limit module not found" >&2
  exit 1
fi

sudo systemctl stop caddy
sudo cp /usr/bin/caddy "/usr/bin/caddy.stock.$(date +%Y%m%d%H%M%S)"
sudo cp ./caddy /usr/bin/caddy
sudo chmod +x /usr/bin/caddy
sudo systemctl start caddy
sudo systemctl is-active caddy
caddy version
echo "Caddy with rate_limit installed."
