#!/usr/bin/env bash
# =====================================================================
#  Установка / обновление CRM мастера маникюра на Ubuntu 22.04 / 24.04
#
#     bash install.sh                        — доступ по IP: http://IP-сервера:8081
#     bash install.sh nails.vash-domen.ru    — с доменом и бесплатным HTTPS
#
#  Можно ставить на тот же сервер, что и CRM Бумсистем: своя служба (nailcrm),
#  свой порт (3100), своя база (/var/lib/nailcrm), свой домен в nginx.
#  Повторный запуск = обновление кода. База данных не затрагивается.
#  Часовой пояс (по умолчанию Канск = Красноярск):  TZ_NAME=Asia/Krasnoyarsk bash install.sh
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
TZ_NAME="${TZ_NAME:-Asia/Krasnoyarsk}"
APP=nailcrm
APP_DIR=/opt/$APP
DATA_DIR=/var/lib/$APP
PORT=3100
IP_PORT=8081
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="$DATA_DIR/domain.conf"

if [ -z "$DOMAIN" ] && [ -f "$CONF" ]; then
  DOMAIN="$(sed -n 1p "$CONF" | tr -cd 'a-zA-Z0-9.-')"
  EMAIL="$(sed -n 2p "$CONF" | tr -cd 'a-zA-Z0-9.@_+-')"
fi

c_ok()  { echo -e "\e[32m✔ $*\e[0m"; }
c_inf() { echo -e "\e[36m→ $*\e[0m"; }
c_err() { echo -e "\e[31m✘ $*\e[0m"; }

[ "$(id -u)" -eq 0 ] || { c_err "Запустите от root: sudo bash install.sh"; exit 1; }
[ -f "$SRC_DIR/server.js" ] || { c_err "Не найден server.js рядом со скриптом"; exit 1; }

if ! swapon --show | grep -q .; then
  c_inf "Создаю swap 1 ГБ"
  fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

c_inf "Устанавливаю системные пакеты…"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
exec </dev/null
APTOPT="-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold -o DPkg::Lock::Timeout=300"
apt-get update -qq
apt-get install -y -qq $APTOPT curl ca-certificates gnupg nginx ufw rsync >/dev/null

NODE_OK=0
if command -v node >/dev/null; then
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' && NODE_OK=1
fi
if [ "$NODE_OK" = 0 ]; then
  c_inf "Устанавливаю Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq $APTOPT nodejs >/dev/null
fi
c_ok "Node.js $(node -v)"

# сертификат Минцифры — нужен для бота MAX
CA_DIR=/usr/local/share/ca-certificates
for n in root sub; do
  F="$CA_DIR/russian_trusted_${n}_ca.crt"
  if [ ! -s "$F" ]; then
    T=$(mktemp)
    if curl -fsSL --max-time 30 "https://gu-st.ru/content/lending/russian_trusted_${n}_ca_pem.crt" -o "$T" && openssl x509 -noout -in "$T" 2>/dev/null; then install -m 644 "$T" "$F"; fi
    rm -f "$T"
  fi
done
update-ca-certificates >/dev/null 2>&1 || true

id $APP >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin $APP
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete --exclude 'data/' --exclude 'dist/' --exclude '.git' --exclude '*.tar.gz' "$SRC_DIR"/ "$APP_DIR"/
chown -R root:root "$APP_DIR"
chown -R $APP:$APP "$DATA_DIR"
chmod 750 "$DATA_DIR"
c_ok "Файлы: $APP_DIR, данные: $DATA_DIR"

cat > /etc/systemd/system/$APP.service <<EOF
[Unit]
Description=Nail master CRM
After=network.target

[Service]
User=$APP
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOST=127.0.0.1
Environment=CRM_DATA=$DATA_DIR
Environment=TZ=$TZ_NAME
Environment=CRM_TZ=$TZ_NAME
Environment=NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ExecStart=/usr/bin/node --max-old-space-size=384 server.js
Restart=always
RestartSec=3
MemoryMax=768M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $APP >/dev/null 2>&1
systemctl restart $APP

PROXY="
    client_max_body_size 25m;
    server_tokens off;
    gzip on;
    gzip_types text/css application/javascript application/json;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }"
NGX=/etc/nginx/sites-available/$APP
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
HAVE_CERT=""
[ -n "$DOMAIN" ] && [ -s "$CERT_DIR/fullchain.pem" ] && HAVE_CERT=1
cp -f "$NGX" "$NGX.bak" 2>/dev/null || true
if [ -n "$HAVE_CERT" ]; then
  SSLOPT=""; [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && SSLOPT="include /etc/letsencrypt/options-ssl-nginx.conf;"
  cat > "$NGX" <<NGXEOF
server {
    listen 443 ssl;
    server_name $DOMAIN www.$DOMAIN;
    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    $SSLOPT
$PROXY
}
server { listen 80; server_name $DOMAIN www.$DOMAIN; location / { return 301 https://$DOMAIN\$request_uri; } }
NGXEOF
elif [ -n "$DOMAIN" ]; then
  cat > "$NGX" <<NGXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
$PROXY
}
NGXEOF
else
  : > "$NGX"
fi
# адрес по IP на отдельном порту работает всегда (запасной вход, не мешает другим сайтам на сервере)
cat >> "$NGX" <<NGXEOF
server {
    listen $IP_PORT;
    server_name _;
$PROXY
}
NGXEOF
ln -sf "$NGX" /etc/nginx/sites-enabled/$APP
if nginx -t -q 2>/dev/null; then systemctl reload nginx
else c_err "Конфиг nginx с ошибкой — оставляю прежний"; cp -f "$NGX.bak" "$NGX" 2>/dev/null && systemctl reload nginx || true; fi
c_ok "nginx настроен"

ufw allow OpenSSH >/dev/null
# все порты SSH (например, дополнительный 2222), чтобы не потерять доступ к серверу
for P in $(sshd -T 2>/dev/null | awk '/^port /{print $2}'); do ufw allow "$P"/tcp >/dev/null; done
ufw allow 'Nginx Full' >/dev/null
ufw allow $IP_PORT/tcp >/dev/null
ufw --force enable >/dev/null

# --- Обновление одной кнопкой из CRM (Настройки → Обновление CRM) ---
TMPU=$(mktemp)
cat > "$TMPU" <<'EOF2'
#!/usr/bin/env bash
# Запускается службой nailcrm-update, когда CRM создаёт заявку update.request
DATA=/var/lib/nailcrm; APP=/opt/nailcrm; REQ=$DATA/update.request; LOG=$DATA/update.log
[ -f "$REQ" ] || exit 0
read -r MODE REPO BR < "$REQ"; rm -f "$REQ"
WORK=$(mktemp -d); BK="$DATA/backups/code-before-update.tgz"
TZ_CUR=$(sed -n 's/^Environment=TZ=//p' /etc/systemd/system/nailcrm.service | head -1)
fail() { echo "✘ $*"; echo "=== Ошибка: $(date '+%d.%m.%Y %H:%M') ==="; rm -rf "$WORK"; chown nailcrm:nailcrm "$LOG"; exit 1; }
{
  echo "→ Получаю новую версию ($MODE)…"
  if [ "$MODE" = github ]; then
    [[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "Неверное имя репозитория"
    [[ "${BR:-main}" =~ ^[A-Za-z0-9_./-]+$ ]] || fail "Неверная ветка"
    curl -fsSL --max-time 300 "https://codeload.github.com/$REPO/tar.gz/refs/heads/${BR:-main}" -o "$WORK/p.tgz" || fail "Не удалось скачать с GitHub"
  elif [ "$MODE" = domain ]; then
    DOM="$REPO"; EM="$BR"
    [[ "$DOM" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Неверный домен"
    [[ -z "$EM" || "$EM" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || fail "Неверная почта"
    echo "→ Подключаю домен $DOM"
    mkdir -p "$WORK/x"; cp -a "$APP" "$WORK/x/nailcrm"; tar czf "$WORK/p.tgz" -C "$WORK/x" nailcrm; rm -rf "$WORK/x"
  elif [ "$MODE" = file ]; then
    mv -f "$DATA/update-upload.tar.gz" "$WORK/p.tgz" || fail "Нет загруженного архива"
  else fail "Неизвестный способ обновления"; fi
  mkdir -p "$WORK/x"; tar xzf "$WORK/p.tgz" -C "$WORK/x" --no-same-owner || fail "Архив повреждён"
  SRVJS=$(find "$WORK/x" -maxdepth 3 -name server.js -not -path '*/node_modules/*' | head -1)
  [ -n "$SRVJS" ] || fail "В архиве нет server.js"
  SRC=$(dirname "$SRVJS")
  grep -q '"name": *"nailcrm"' "$SRC/package.json" 2>/dev/null || fail "Это не архив CRM мастера"
  NEWV=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$SRC/package.json" | head -1)
  echo "→ Новая версия: $NEWV"
  echo "→ Копия базы и текущего кода…"
  mkdir -p "$DATA/backups"; chown nailcrm:nailcrm "$DATA/backups"
  (cd "$APP" && sudo -u nailcrm env CRM_DATA="$DATA" /usr/bin/node scripts/backup.js) || echo "  (копия базы не сделана, продолжаю)"
  tar czf "$BK" -C /opt nailcrm || fail "Не удалось сохранить текущую версию"
  echo "→ Устанавливаю…"
  ARGS=(); [ "$MODE" = domain ] && ARGS=("$DOM" "$EM")
  if (cd "$SRC" && TZ_NAME="${TZ_CUR:-Asia/Krasnoyarsk}" bash install.sh "${ARGS[@]}") > "$WORK/install.log" 2>&1; then OK=1; else OK=0; fi
  grep -E '✔|✘' "$WORK/install.log" | sed 's/\x1b\[[0-9;]*m//g'
  sleep 3
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/me || true)
  if [ "$OK" = 1 ] && [ "$CODE" = 200 ] && [ "$MODE" = domain ] && grep -q 'Сертификат не получен' "$WORK/install.log"; then
    echo "=== Ошибка: домен $DOM подключён без HTTPS — сертификат не выдан. Проверьте A-запись и повторите через 15–30 минут ==="
  elif [ "$OK" = 1 ] && [ "$CODE" = 200 ]; then
    echo "=== Готово: версия $NEWV, $(date '+%d.%m.%Y %H:%M') ==="
  else
    echo "✘ Новая версия не запустилась (код $CODE) — возвращаю прежнюю"
    tail -n 20 "$WORK/install.log" | sed 's/\x1b\[[0-9;]*m//g'
    rm -rf "$APP" && tar xzf "$BK" -C /opt && systemctl restart nailcrm
    echo "=== Откат: прежняя версия восстановлена, $(date '+%d.%m.%Y %H:%M') ==="
  fi
  rm -rf "$WORK"
} >> "$LOG" 2>&1 < /dev/null
chown nailcrm:nailcrm "$LOG"
EOF2
chmod 755 "$TMPU"; mv -f "$TMPU" /usr/local/bin/nailcrm-update   # mv: работающая копия скрипта не ломается
cat > /etc/systemd/system/nailcrm-update.service <<EOF2
[Unit]
Description=Nail CRM self-update
[Service]
Type=oneshot
ExecStart=/usr/local/bin/nailcrm-update
TimeoutStartSec=1800
EOF2
cat > /etc/systemd/system/nailcrm-update.path <<EOF2
[Unit]
Description=Watch for nail CRM update request
[Path]
PathExists=$DATA_DIR/update.request
[Install]
WantedBy=multi-user.target
EOF2
systemctl daemon-reload
systemctl enable --now nailcrm-update.path >/dev/null 2>&1
c_ok "Обновление одной кнопкой включено (CRM → Настройки → Обновление CRM)"

if [ -n "$DOMAIN" ] && [ -z "$HAVE_CERT" ]; then
  c_inf "HTTPS для $DOMAIN"
  command -v certbot >/dev/null || apt-get install -y -qq $APTOPT certbot python3-certbot-nginx >/dev/null
  if [ -n "$EMAIL" ]; then EM="-m $EMAIL"; else EM="--register-unsafely-without-email"; fi
  # сертификат и на www, если www указывает на этот сервер; иначе — только на основной домен
  if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --cert-name "$DOMAIN" --non-interactive --agree-tos --keep-until-expiring --expand $EM --redirect -q 2>/dev/null \
     || certbot --nginx -d "$DOMAIN" --cert-name "$DOMAIN" --non-interactive --agree-tos --keep-until-expiring $EM --redirect -q; then
    c_ok "HTTPS включён"
  else
    c_err "Сертификат не получен. Проверьте A-запись $DOMAIN и запустите скрипт снова."
  fi
fi
[ -n "$DOMAIN" ] && { printf '%s\n%s\n' "$DOMAIN" "$EMAIL" > "$CONF"; chown $APP:$APP "$CONF"; }

sleep 2
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/me" || true)
[ "$CODE" = "200" ] && c_ok "CRM запущена" || c_err "CRM не отвечает (код $CODE). Лог: journalctl -u $APP -n 50"

IP=$(curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo
echo "=============================================================="
[ -n "$DOMAIN" ] && echo "  Сайт:  https://$DOMAIN     CRM: https://$DOMAIN/crm"
echo "  По IP: http://$IP:$IP_PORT     CRM: http://$IP:$IP_PORT/crm"
if [ -f "$DATA_DIR/FIRST_ADMIN_PASSWORD.txt" ]; then
  echo "  Первый вход:"; sed 's/^/    /' "$DATA_DIR/FIRST_ADMIN_PASSWORD.txt"
  echo "  Смените пароль в Настройках, затем: rm $DATA_DIR/FIRST_ADMIN_PASSWORD.txt"
fi
echo "=============================================================="
