#!/usr/bin/env bash
#
# Ивээл Карго — Backend (amarhan-api) production deploy
# GitHub АШИГЛАХГҮЙ: локал эх кодыг rsync-ээр шууд серверт хуулж, npm install
# хийгээд pm2 restart хийнэ.
#
# Хэрэглээ:
#   ./deploy-backend.sh              # deploy
#   ./deploy-backend.sh rollback     # өмнөх хувилбар руу буцаах (.deploy-bak/amarhan-api)
#
# Тохиргоог environment-ээр дарж болно:
#   SSH_KEY=... SSH_HOST=... ./deploy-backend.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_SRC="${BACKEND_SRC:-$SCRIPT_DIR/amarhan-api}"
SSH_KEY="${SSH_KEY:-$SCRIPT_DIR/hurdan.pem}"
SSH_HOST="${SSH_HOST:-ubuntu@ec2-13-214-22-1.ap-southeast-1.compute.amazonaws.com}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/iveel-amarhan}"
BACKEND_DIR="${BACKEND_DIR:-$REMOTE_ROOT/amarhan-api}"
PM2_PROCESS="${PM2_PROCESS:-iveelt-api}"
# Сервер дээрх pm2 процесс node 22-оор ажилладаг (ecosystem.config.cjs)
NODE_BIN="${NODE_BIN:-/home/ubuntu/.nvm/versions/node/v22.22.2/bin}"
HEALTH_URL="${HEALTH_URL:-https://iweeltcargo.com/api/status}"

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"

c_reset='\033[0m'; c_blue='\033[1;34m'; c_green='\033[1;32m'; c_red='\033[1;31m'; c_yellow='\033[1;33m'
info() { printf "${c_blue}▶ %s${c_reset}\n" "$*"; }
ok()   { printf "${c_green}✔ %s${c_reset}\n" "$*"; }
err()  { printf "${c_red}✘ %s${c_reset}\n" "$*" >&2; }
die()  { err "$*"; exit 1; }

[ -d "$BACKEND_SRC" ] || die "Backend эх код олдсонгүй: $BACKEND_SRC"
[ -f "$SSH_KEY" ] || die "SSH түлхүүр олдсонгүй: $SSH_KEY"
command -v rsync >/dev/null 2>&1 || die "rsync шаардлагатай (локал дээр суулгана уу)"
chmod 600 "$SSH_KEY" 2>/dev/null || true

check_health() {
  local body
  body=$(curl -fsS --max-time 20 "$HEALTH_URL" 2>/dev/null || true)
  if printf '%s' "$body" | grep -q '"status":"OK"'; then
    ok "API амьд — $HEALTH_URL → OK"
    return 0
  fi
  err "API health унасан: ${body:-<хоосон>}"
  return 1
}

deploy() {
  info "Одоогийн серверийн эх кодыг нөөцөлж байна (.deploy-bak/amarhan-api) ..."
  ssh $SSH_OPTS "$SSH_HOST" \
    "mkdir -p '$REMOTE_ROOT/.deploy-bak' && rm -rf '$REMOTE_ROOT/.deploy-bak/amarhan-api' && \
     if [ -d '$BACKEND_DIR/src' ]; then cp -r '$BACKEND_DIR' '$REMOTE_ROOT/.deploy-bak/amarhan-api'; fi"

  info "Эх кодыг rsync-ээр серверт хуулж байна ($BACKEND_SRC -> $SSH_HOST:$BACKEND_DIR) ..."
  # --exclude='uploads': локал дээр энэ directory хоосон (.gitignore-д орсон) тул
  # exclude хийхгүй бол --delete нь серверт хадгалагдсан бодит upload-уудыг (жишээ нь
  # хаяг холбох зааврын зурагнуудыг) устгачихна.
  rsync -az --delete \
    --exclude='.env' --exclude='.env.*' --exclude='node_modules' \
    --exclude='logs' --exclude='test' --exclude='.git' --exclude='uploads' \
    -e "ssh $SSH_OPTS" \
    "$BACKEND_SRC/" "$SSH_HOST:$BACKEND_DIR/"

  info "Серверт npm install + pm2 restart хийж байна ..."
  ssh $SSH_OPTS "$SSH_HOST" 'bash -s' <<REMOTE
    set -e
    export PATH=$NODE_BIN:\$PATH
    cd $BACKEND_DIR
    mkdir -p logs
    npm install --omit=dev --no-audit --no-fund
    if pm2 describe $PM2_PROCESS >/dev/null 2>&1; then
      pm2 restart $PM2_PROCESS --update-env
    else
      pm2 start $REMOTE_ROOT/ecosystem.config.cjs --only $PM2_PROCESS
    fi
    pm2 save
    sleep 3
REMOTE

  info "Health шалгаж байна ..."
  check_health || die "Deploy хийгдсэн ч health унасан байна. Лог: ssh -i $SSH_KEY $SSH_HOST 'pm2 logs $PM2_PROCESS' (rollback: ./deploy-backend.sh rollback)"
  ok "Backend deploy амжилттай 🎉"
}

rollback() {
  info "Өмнөх хувилбар руу буцааж байна (.deploy-bak/amarhan-api) ..."
  ssh $SSH_OPTS "$SSH_HOST" 'bash -s' <<REMOTE
    set -e
    export PATH=$NODE_BIN:\$PATH
    test -d '$REMOTE_ROOT/.deploy-bak/amarhan-api/src' || { echo "Backup алга — rollback боломжгүй"; exit 1; }
    rsync -a --delete --exclude='.env' --exclude='node_modules' --exclude='logs' --exclude='uploads' \
      '$REMOTE_ROOT/.deploy-bak/amarhan-api/' '$BACKEND_DIR/'
    cd $BACKEND_DIR
    npm install --omit=dev --no-audit --no-fund
    pm2 restart $PM2_PROCESS --update-env
    pm2 save
    sleep 3
REMOTE
  check_health && ok "Rollback амжилттай" || die "Rollback дараа ч health унаж байна"
}

case "${1:-deploy}" in
  deploy)   deploy ;;
  rollback) rollback ;;
  *) die "Тодорхойгүй команд: ${1:-}. Хэрэглээ: ./deploy-backend.sh [deploy|rollback]" ;;
esac
