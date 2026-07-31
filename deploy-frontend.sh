#!/usr/bin/env bash
#
# Ивээл Карго — Frontend (amarhan-front, Nuxt SSR) production deploy
# Локал дээр `nuxt build` хийгээд, .output-г tar-ласаар scp-ээр серверт
# хуулж, хуучин хувилбарыг .output.prev болгон нөөцөлсний дараа сольж
# pm2-оор ажиллуулна.
#
# Хэрэглээ:
#   ./deploy-frontend.sh              # build + deploy
#   ./deploy-frontend.sh rollback     # .output.prev рүү буцаах
#
# Тохиргоог environment-ээр дарж болно:
#   SSH_KEY=... SSH_HOST=... NUXT_PUBLIC_API_URL=... ./deploy-frontend.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FRONTEND_DIR="${FRONTEND_DIR:-$SCRIPT_DIR/amarhan-front}"
SSH_KEY="${SSH_KEY:-$SCRIPT_DIR/hurdan.pem}"
SSH_HOST="${SSH_HOST:-ubuntu@ec2-13-214-22-1.ap-southeast-1.compute.amazonaws.com}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/iveel-amarhan}"
REMOTE_FRONTEND_DIR="${REMOTE_FRONTEND_DIR:-$REMOTE_ROOT/amarhan-front}"
PM2_PROCESS="${PM2_PROCESS:-iveelt-front}"
NODE_BIN="${NODE_BIN:-/home/ubuntu/.nvm/versions/node/v22.22.2/bin}"
HEALTH_URL="${HEALTH_URL:-https://iveelt.amarhan.mn/}"
NUXT_PUBLIC_API_URL="${NUXT_PUBLIC_API_URL:-https://iveelt.amarhan.mn}"

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"

ARCHIVE_NAME="amarhan-front-output-$(date +%Y%m%d%H%M%S).tar.gz"
LOCAL_ARCHIVE="${SCRIPT_DIR}/${ARCHIVE_NAME}"
REMOTE_ARCHIVE="/tmp/${ARCHIVE_NAME}"
REMOTE_RELEASE_DIR="${REMOTE_FRONTEND_DIR}/.output.new"
REMOTE_BACKUP_DIR="${REMOTE_FRONTEND_DIR}/.output.prev"

c_reset='\033[0m'; c_blue='\033[1;34m'; c_green='\033[1;32m'; c_red='\033[1;31m'; c_yellow='\033[1;33m'
info() { printf "${c_blue}▶ %s${c_reset}\n" "$*"; }
ok()   { printf "${c_green}✔ %s${c_reset}\n" "$*"; }
err()  { printf "${c_red}✘ %s${c_reset}\n" "$*" >&2; }
die()  { err "$*"; exit 1; }

[ -d "$FRONTEND_DIR" ] || die "Frontend directory олдсонгүй: $FRONTEND_DIR"
[ -f "$SSH_KEY" ] || die "SSH түлхүүр олдсонгүй: $SSH_KEY"
chmod 600 "$SSH_KEY" 2>/dev/null || true

cleanup() { rm -f "$LOCAL_ARCHIVE"; }
trap cleanup EXIT

check_health() {
  local code
  code=$(curl -o /dev/null -s -w '%{http_code}' --max-time 20 "$HEALTH_URL" || echo "000")
  if [ "$code" = "200" ]; then
    ok "Frontend амьд (HTTP $code) — $HEALTH_URL"
    return 0
  fi
  err "Frontend health унасан (HTTP $code)"
  return 1
}

deploy() {
  info "Локал build хийж байна ($FRONTEND_DIR) ..."
  (
    cd "$FRONTEND_DIR"
    npm install --no-audit --no-fund
    NUXT_PUBLIC_API_URL="$NUXT_PUBLIC_API_URL" npm run build
  )
  [ -f "$FRONTEND_DIR/.output/server/index.mjs" ] || die "Build амжилтгүй: .output/server/index.mjs алга"

  info "Nuxt output-г архивлаж байна ..."
  tar -czf "$LOCAL_ARCHIVE" -C "$FRONTEND_DIR" .output

  info "Серверт scp хийж байна ..."
  scp $SSH_OPTS "$LOCAL_ARCHIVE" "$SSH_HOST:$REMOTE_ARCHIVE"

  info "Серверт задалж, сольж, pm2 restart хийж байна ..."
  ssh $SSH_OPTS "$SSH_HOST" 'bash -s' <<REMOTE
    set -e
    export PATH=$NODE_BIN:\$PATH
    mkdir -p "$REMOTE_FRONTEND_DIR"
    rm -rf "$REMOTE_RELEASE_DIR"
    mkdir -p "$REMOTE_RELEASE_DIR"
    tar -xzf "$REMOTE_ARCHIVE" -C "$REMOTE_RELEASE_DIR"
    test -f "$REMOTE_RELEASE_DIR/.output/server/index.mjs" || { echo "STAGING БҮРЭН БУС"; exit 1; }
    rm -rf "$REMOTE_BACKUP_DIR"
    if [ -d "$REMOTE_FRONTEND_DIR/.output" ]; then mv "$REMOTE_FRONTEND_DIR/.output" "$REMOTE_BACKUP_DIR"; fi
    mv "$REMOTE_RELEASE_DIR/.output" "$REMOTE_FRONTEND_DIR/.output"
    rm -rf "$REMOTE_RELEASE_DIR" "$REMOTE_ARCHIVE"
    cd "$REMOTE_FRONTEND_DIR"
    if pm2 describe "$PM2_PROCESS" >/dev/null 2>&1; then
      pm2 restart "$PM2_PROCESS" --update-env
    else
      pm2 start ../ecosystem.config.cjs --only "$PM2_PROCESS"
    fi
    pm2 save
    sleep 4
REMOTE

  info "Health шалгаж байна ..."
  check_health || die "Deploy хийгдсэн ч health унасан. Лог: ssh -i $SSH_KEY $SSH_HOST 'pm2 logs $PM2_PROCESS' (rollback: ./deploy-frontend.sh rollback)"
  ok "Frontend deploy амжилттай 🎉"
}

rollback() {
  info "Өмнөх .output.prev рүү буцааж байна ..."
  ssh $SSH_OPTS "$SSH_HOST" 'bash -s' <<REMOTE
    set -e
    export PATH=$NODE_BIN:\$PATH
    cd "$REMOTE_FRONTEND_DIR"
    test -d .output.prev || { echo "Backup (.output.prev) алга — rollback боломжгүй"; exit 1; }
    rm -rf .output.rollback
    mv .output .output.rollback
    mv .output.prev .output
    pm2 restart "$PM2_PROCESS" --update-env
    pm2 save
    sleep 4
REMOTE
  check_health && ok "Frontend rollback амжилттай" || die "Rollback дараа ч health унаж байна"
}

case "${1:-deploy}" in
  deploy)   deploy ;;
  rollback) rollback ;;
  *) die "Тодорхойгүй команд: ${1:-}. Хэрэглээ: ./deploy-frontend.sh [deploy|rollback]" ;;
esac
