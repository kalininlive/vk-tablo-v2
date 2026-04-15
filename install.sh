#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/vk-stream"
ENV_FILE=".vps.env"

JWT_SECRET="${JWT_SECRET:-}"
SECRET_KEY_BASE="${SECRET_KEY_BASE:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
CONTROL_SECRET="${CONTROL_SECRET:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"

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

prompt_if_empty "SERVER_HOST" "Введите домен (пример: my-stream.example.com)"
prompt_if_empty "ADMIN_USERNAME" "Введите логин админ-панели"

if [[ -z "${ADMIN_PASSWORD_HASH:-}" ]]; then
  prompt_if_empty "ADMIN_PASSWORD" "Введите пароль админ-панели (мин. 6 символов)" "true"

  if [[ "${#ADMIN_PASSWORD}" -lt 6 ]]; then
    echo "Ошибка: пароль должен быть не короче 6 символов"
    exit 1
  fi

  ADMIN_PASSWORD_HASH="$(printf "%s" "${ADMIN_PASSWORD}" | sha256sum | awk '{print $1}')"
  unset ADMIN_PASSWORD
fi

if ! [[ "${ADMIN_PASSWORD_HASH}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Ошибка: ADMIN_PASSWORD_HASH должен быть SHA-256 hex (64 символа)"
  exit 1
fi

if [[ -z "${JWT_SECRET}" ]]; then
  JWT_SECRET="$(generate_secret 48)"
fi

if [[ -z "${SECRET_KEY_BASE}" ]]; then
  SECRET_KEY_BASE="$(generate_secret 64)"
fi

if [[ -z "${DB_PASSWORD}" ]]; then
  DB_PASSWORD="$(generate_secret 32)"
fi

if [[ -z "${CONTROL_SECRET}" ]]; then
  CONTROL_SECRET="$(generate_secret 32)"
fi

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
    "iss": "vk-transleator",
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

echo "[1/6] Установка базовых пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  nginx \
  openssl \
  python3 \
  python3-psycopg2 \
  docker.io \
  docker-compose-plugin

systemctl enable docker
systemctl restart docker

echo "[2/6] Подготовка директорий"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/pgdata"

echo "[3/6] Генерация nginx-rtmp.conf"
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

echo "[4/6] Подготовка docker-compose"
cp -f "${PROJECT_ROOT}/docker-compose.db.yml" "${INSTALL_DIR}/docker-compose.db.yml"

echo "[5/6] Запуск контейнеров"
set -a
source "${PROJECT_ROOT}/${ENV_FILE}"
set +a

docker compose -f "${INSTALL_DIR}/docker-compose.db.yml" down -v --remove-orphans || true
docker compose -f "${INSTALL_DIR}/docker-compose.db.yml" up -d --remove-orphans

echo "[5.1/6] Ожидание запуска PostgreSQL"
for i in {1..30}; do
  if docker exec vk-postgres pg_isready -U postgres > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker exec vk-postgres pg_isready -U postgres > /dev/null 2>&1; then
  echo "Ошибка: PostgreSQL не поднялся вовремя"
  exit 1
fi

echo "[5.2/6] Ожидание и provisioning Realtime tenant"
sleep 5
for i in {1..20}; do
  if docker exec -i vk-postgres psql -U postgres -d postgres -c "SELECT 1 FROM _realtime.tenants LIMIT 1;" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker exec -i vk-postgres psql -U postgres -d postgres <<EOF
INSERT INTO _realtime.tenants (external_id, jwt_secret)
VALUES ('vk-transleator', '${JWT_SECRET}')
ON CONFLICT (external_id)
DO UPDATE SET jwt_secret = EXCLUDED.jwt_secret;
EOF

echo "[5.3/6] Применение SQL схемы"
sleep 20
docker exec -i vk-postgres psql -U postgres -d postgres < "${PROJECT_ROOT}/supabase_setup.sql"

echo "[6/6] Обновление app_config"
docker exec -i vk-postgres psql -U postgres -d postgres <<EOF
INSERT INTO app_config (id, username, password_hash, control_api_url, control_secret)
VALUES (1, '${ADMIN_USERNAME}', '${ADMIN_PASSWORD_HASH}', '', '${CONTROL_SECRET}')
ON CONFLICT (id)
DO UPDATE SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  control_secret = EXCLUDED.control_secret;
EOF

echo
echo "Инфраструктура Этапа 1 развернута. Проверка контейнеров:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo "Ожидается 4 контейнера в статусе Up:"
echo "- vk-postgres"
echo "- vk-postgrest"
echo "- vk-realtime"
echo "- vk-nginx-rtmp"
