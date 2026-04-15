#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/vk-stream"
ENV_FILE=".vps.env"
API_SERVICE_NAME="vk-stream-control"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ошибка: запустите скрипт от root (sudo -i)."
  exit 1
fi

if [[ -f "${PROJECT_ROOT}/${ENV_FILE}" ]]; then
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/${ENV_FILE}"
fi

prompt_if_empty() {
  local var_name="$1"
  local prompt_text="$2"
  local silent="${3:-false}"

  if [[ -z "${!var_name:-}" ]]; then
    if [[ "${silent}" == "true" ]]; then
      read -r -s -p "${prompt_text}: " value
      echo
    else
      read -r -p "${prompt_text}: " value
    fi
    export "${var_name}=${value}"
  fi
}

generate_secret() {
  local token_bytes="$1"
  python3 - <<PY
import secrets
print(secrets.token_urlsafe(${token_bytes}))
PY
}

sha256_hex() {
  printf "%s" "$1" | sha256sum | awk '{print $1}'
}

ensure_node20() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [[ "${major}" == "20" ]]; then
      return
    fi
  fi

  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

install_docker_compose() {
  if apt-get install -y docker-compose-plugin; then
    return
  fi

  echo "Пакет docker-compose-plugin не найден, ставлю docker-compose"
  apt-get install -y docker-compose
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Ошибка: не найден docker compose (plugin или docker-compose)"
  exit 1
}

configure_obs_repo() {
  if ! grep -Rq "obsproject/obs-studio" /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null; then
    add-apt-repository -y ppa:obsproject/obs-studio
    apt-get update
  fi
}

prompt_if_empty "SERVER_HOST" "Введите домен (пример: my-stream.example.com)"
prompt_if_empty "ADMIN_USERNAME" "Введите логин админ-панели"

if [[ -z "${ADMIN_PASSWORD_HASH:-}" ]]; then
  prompt_if_empty "ADMIN_PASSWORD" "Введите пароль админ-панели (мин. 6 символов)" "true"
  if [[ "${#ADMIN_PASSWORD}" -lt 6 ]]; then
    echo "Ошибка: пароль должен быть не короче 6 символов"
    exit 1
  fi
  ADMIN_PASSWORD_HASH="$(sha256_hex "${ADMIN_PASSWORD}")"
  unset ADMIN_PASSWORD
fi

if ! [[ "${ADMIN_PASSWORD_HASH}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Ошибка: ADMIN_PASSWORD_HASH должен быть SHA-256 hex (64 символа)"
  exit 1
fi

JWT_SECRET="${JWT_SECRET:-$(generate_secret 48)}"
SECRET_KEY_BASE="${SECRET_KEY_BASE:-$(generate_secret 64)}"
DB_PASSWORD="${DB_PASSWORD:-$(generate_secret 32)}"
CONTROL_SECRET="${CONTROL_SECRET:-$(generate_secret 32)}"

ANON_TOKEN="$(python3 - <<PY
import base64
import hashlib
import hmac
import json
import time

secret = "${JWT_SECRET}".encode()
header = {"alg": "HS256", "typ": "JWT"}
payload = {
    "role": "anon",
    "iss": "vk-tablo-v2",
    "iat": int(time.time()),
    "exp": int(time.time()) + 60 * 60 * 24 * 365 * 10,
}

def b64url(data: bytes) -> bytes:
    return base64.urlsafe_b64encode(data).rstrip(b"=")

signing_input = b".".join([
    b64url(json.dumps(header, separators=(",", ":")).encode()),
    b64url(json.dumps(payload, separators=(",", ":")).encode()),
])
signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
print((signing_input + b"." + b64url(signature)).decode())
PY
)"

{
  printf "SERVER_HOST=%q\n" "${SERVER_HOST}"
  printf "ADMIN_USERNAME=%q\n" "${ADMIN_USERNAME}"
  printf "ADMIN_PASSWORD_HASH=%q\n" "${ADMIN_PASSWORD_HASH}"
  printf "JWT_SECRET=%q\n" "${JWT_SECRET}"
  printf "SECRET_KEY_BASE=%q\n" "${SECRET_KEY_BASE}"
  printf "DB_PASSWORD=%q\n" "${DB_PASSWORD}"
  printf "CONTROL_SECRET=%q\n" "${CONTROL_SECRET}"
  printf "ANON_TOKEN=%q\n" "${ANON_TOKEN}"
} > "${PROJECT_ROOT}/${ENV_FILE}"
chmod 600 "${PROJECT_ROOT}/${ENV_FILE}"

echo "[1/10] Установка пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  software-properties-common \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  openssl \
  ffmpeg \
  xvfb \
  nginx \
  certbot \
  python3-certbot-nginx \
  python3 \
  python3-pip \
  python3-flask \
  python3-psycopg2 \
  docker.io

install_docker_compose

configure_obs_repo
apt-get install -y obs-studio
ensure_node20

echo "[2/10] Подготовка директорий"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/pgdata"
mkdir -p "${INSTALL_DIR}/api"
mkdir -p "/var/www/vk-stream"

echo "[3/10] Подготовка RTMP nginx"
cat > "${INSTALL_DIR}/nginx-rtmp.conf" <<'EOF'
worker_processes auto;

events {
  worker_connections 1024;
}

rtmp {
  server {
    listen 1935;
    chunk_size 4096;

    application live {
      live on;
      record off;

      hls on;
      hls_path /tmp/hls;
      hls_fragment 1s;
      hls_playlist_length 6s;
    }
  }
}

http {
  server {
    listen 8080;

    location /hls {
      types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t ts;
      }
      root /tmp;
      add_header Cache-Control no-cache;
      add_header Access-Control-Allow-Origin *;
    }
  }
}
EOF

echo "[4/10] Подготовка docker compose"
SOURCE_COMPOSE="$(realpath "${PROJECT_ROOT}/docker-compose.db.yml")"
TARGET_COMPOSE="$(realpath -m "${INSTALL_DIR}/docker-compose.db.yml")"

if [[ "${SOURCE_COMPOSE}" != "${TARGET_COMPOSE}" ]]; then
  cp -f "${PROJECT_ROOT}/docker-compose.db.yml" "${INSTALL_DIR}/docker-compose.db.yml"
fi

set -a
source "${PROJECT_ROOT}/${ENV_FILE}"
set +a

echo "[5/10] Запуск Docker сервисов"
systemctl enable docker
systemctl restart docker
compose -f "${INSTALL_DIR}/docker-compose.db.yml" down -v --remove-orphans || true
compose -f "${INSTALL_DIR}/docker-compose.db.yml" up -d --remove-orphans

echo "[6/10] Инициализация PostgreSQL / Realtime"
for _ in {1..45}; do
  if docker exec vk-postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker exec vk-postgres pg_isready -U postgres >/dev/null 2>&1; then
  echo "Ошибка: PostgreSQL не поднялся вовремя"
  exit 1
fi

sleep 5
docker exec -i vk-postgres psql -U postgres -d postgres <<EOF
INSERT INTO _realtime.tenants (external_id, jwt_secret)
VALUES ('vk-tablo-v2', '${JWT_SECRET}')
ON CONFLICT (external_id)
DO UPDATE SET jwt_secret = EXCLUDED.jwt_secret;
EOF

sleep 20
docker exec -i vk-postgres psql -U postgres -d postgres < "${PROJECT_ROOT}/supabase_setup.sql"

docker exec -i vk-postgres psql -U postgres -d postgres <<EOF
INSERT INTO app_config (id, username, password_hash, control_api_url, control_secret)
VALUES (1, '${ADMIN_USERNAME}', '${ADMIN_PASSWORD_HASH}', 'https://${SERVER_HOST}/stream-control/', '${CONTROL_SECRET}')
ON CONFLICT (id)
DO UPDATE SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  control_api_url = EXCLUDED.control_api_url,
  control_secret = EXCLUDED.control_secret;
EOF

echo "[7/10] Деплой backend API"
cp -f "${PROJECT_ROOT}/api.py" "${INSTALL_DIR}/api/main.py"
chmod 755 "${INSTALL_DIR}/api/main.py"

cat > "/etc/systemd/system/${API_SERVICE_NAME}.service" <<EOF
[Unit]
Description=VK Stream Control API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/api
EnvironmentFile=${PROJECT_ROOT}/${ENV_FILE}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/api/main.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${API_SERVICE_NAME}"
systemctl restart "${API_SERVICE_NAME}"

echo "[8/10] Сборка и публикация frontend"
if [[ -f "${PROJECT_ROOT}/app/package.json" ]]; then
  cat > "${PROJECT_ROOT}/app/.env" <<EOF
VITE_SUPABASE_URL=https://${SERVER_HOST}
VITE_SUPABASE_ANON_KEY=${ANON_TOKEN}
EOF

  npm --prefix "${PROJECT_ROOT}/app" install
  npm --prefix "${PROJECT_ROOT}/app" run build
  cp -rv "${PROJECT_ROOT}/app/dist/"* "/var/www/vk-stream/"
else
  cat > "/var/www/vk-stream/index.html" <<EOF
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VK Tablo v2</title>
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h1>VK Tablo v2</h1>
  <p>Frontend пока не добавлен в репозиторий.</p>
</body>
</html>
EOF
fi

echo "[9/10] SSL и nginx"
systemctl stop nginx || true
certbot certonly --standalone --non-interactive --agree-tos --register-unsafely-without-email -d "${SERVER_HOST}"

cat > /etc/nginx/sites-available/vk-stream <<EOF
server {
    listen 80;
    server_name ${SERVER_HOST};
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl http2;
    server_name ${SERVER_HOST};
    ssl_certificate /etc/letsencrypt/live/${SERVER_HOST}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${SERVER_HOST}/privkey.pem;

    root /var/www/vk-stream;
    index index.html;

    location / { try_files \$uri \$uri/ /index.html; }
    location /rest/v1/ { proxy_pass http://127.0.0.1:3000/; }
    location /realtime/v1/ {
        proxy_pass http://127.0.0.1:4000/socket/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
    location /stream-control/ { proxy_pass http://127.0.0.1:5000/; }
    location /hls/ { proxy_pass http://127.0.0.1:8080/hls/; }
}
EOF

ln -sf /etc/nginx/sites-available/vk-stream /etc/nginx/sites-enabled/vk-stream
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "[10/10] Финальная проверка"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
systemctl --no-pager --full status "${API_SERVICE_NAME}" | sed -n '1,12p'

echo
echo "Готово. Откройте: https://${SERVER_HOST}"
echo "Проверка API: curl -s https://${SERVER_HOST}/stream-control/status"
