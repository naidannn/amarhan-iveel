#!/usr/bin/env bash
#
# Ивээл Карго — Frontend (amarhan-front, Nuxt SSR) production deploy
# Локал дээр `nuxt build` хийгээд, .output-г tar-лаад scp-ээр серверт хуулж,
# release-front-оор атомаар сольж (өмнөх нь .output.prev) pm2 reload хийнэ.
#
# Сервер: Contabo (ssh alias "contabo")
#   /srv/apps/iveelt/amarhan-front, pm2 "iveelt-front" (port 3013) → https://iweeltcargo.com
#   PM2 тохиргоо: /srv/apps/ecosystem.config.js
#
# Хэрэглээ:
#   ./deploy-frontend.sh              # build + deploy
#   ./deploy-frontend.sh rollback     # .output.prev рүү буцаах
#
# Тохиргоог environment-ээр дарж болно:
#   SSH_HOST=... NUXT_PUBLIC_API_URL=... ./deploy-frontend.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FRONTEND_DIR="${FRONTEND_DIR:-$SCRIPT_DIR/amarhan-front}"
SSH_HOST="${SSH_HOST:-contabo}"   # ~/.ssh/config: deploy@184.174.37.49
REMOTE_FRONTEND_DIR="${REMOTE_FRONTEND_DIR:-/srv/apps/iveelt/amarhan-front}"
PM2_PROCESS="${PM2_PROCESS:-iveelt-front}"
ECOSYSTEM="/srv/apps/ecosystem.config.js"
HEALTH_URL="${HEALTH_URL:-https://iweeltcargo.com/}"
NUXT_PUBLIC_API_URL="${NUXT_PUBLIC_API_URL:-https://iweeltcargo.com}"

SSH_OPTS="-o ConnectTimeout=20"

ARCHIVE_NAME="iveelt-front-$(date +%Y%m%d%H%M%S).tgz"
LOCAL_ARCHIVE="${SCRIPT_DIR}/${ARCHIVE_NAME}"
REMOTE_ARCHIVE="/tmp/${ARCHIVE_NAME}"

c_reset='\033[0m'; c_blue='\033[1;34m'; c_green='\033[1;32m'; c_red='\033[1;31m'; c_yellow='\033[1;33m'
info() { printf "${c_blue}▶ %s${c_reset}\n" "$*"; }
ok()   { printf "${c_green}✔ %s${c_reset}\n" "$*"; }
err()  { printf "${c_red}✘ %s${c_reset}\n" "$*" >&2; }
die()  { err "$*"; exit 1; }

[ -d "$FRONTEND_DIR" ] || die "Frontend directory олдсонгүй: $FRONTEND_DIR"

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
    NODE_ENV=production NUXT_PUBLIC_API_URL="$NUXT_PUBLIC_API_URL" npm run build
  )
  [ -f "$FRONTEND_DIR/.output/server/index.mjs" ] || die "Build амжилтгүй: .output/server/index.mjs алга"

  info "Nuxt output-г архивлаж байна ..."
  COPYFILE_DISABLE=1 tar -czf "$LOCAL_ARCHIVE" -C "$FRONTEND_DIR" .output 2>/dev/null

  info "Серверт scp хийж байна ..."
  scp -q $SSH_OPTS "$LOCAL_ARCHIVE" "$SSH_HOST:$REMOTE_ARCHIVE"

  # release-front: .output-ыг атомаар солино (өмнөх: .output.prev), серверийн sharp-ийг хадгална
  info "Сервер дээр release-front $PM2_PROCESS ..."
  ssh $SSH_OPTS "$SSH_HOST" release-front "$PM2_PROCESS" "$REMOTE_ARCHIVE"

  info "Health шалгаж байна ..."
  check_health || die "Deploy хийгдсэн ч health унасан. Лог: ssh $SSH_HOST 'pm2 logs $PM2_PROCESS' (rollback: ./deploy-frontend.sh rollback)"
  ok "Frontend deploy амжилттай 🎉"
}

rollback() {
  info "Өмнөх .output.prev рүү буцааж байна ..."
  ssh $SSH_OPTS "$SSH_HOST" 'bash -s' <<REMOTE
    set -e
    cd "$REMOTE_FRONTEND_DIR"
    test -d .output.prev || { echo "Backup (.output.prev) алга — rollback боломжгүй"; exit 1; }
    rm -rf .output.rollback
    mv .output .output.rollback
    mv .output.prev .output
    pm2 reload $ECOSYSTEM --only "$PM2_PROCESS" --update-env
    sleep 4
REMOTE
  check_health && ok "Frontend rollback амжилттай" || die "Rollback дараа ч health унаж байна"
}

case "${1:-deploy}" in
  deploy)   deploy ;;
  rollback) rollback ;;
  *) die "Тодорхойгүй команд: ${1:-}. Хэрэглээ: ./deploy-frontend.sh [deploy|rollback]" ;;
esac
