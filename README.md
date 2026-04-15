# VK Tablo v2

Репозиторий для one-command развёртывания VK-трансляции на Ubuntu 22.04.

## Что в репозитории

- [`install.sh`](https://github.com/kalininlive/vk-tablo-v2/blob/master/install.sh) — установщик инфраструктуры (один запуск)
- [`docker-compose.db.yml`](https://github.com/kalininlive/vk-tablo-v2/blob/master/docker-compose.db.yml) — PostgreSQL + PostgREST + Realtime + RTMP
- [`supabase_setup.sql`](https://github.com/kalininlive/vk-tablo-v2/blob/master/supabase_setup.sql) — схема БД и RLS
- [`api.py`](https://github.com/kalininlive/vk-tablo-v2/blob/master/api.py) — Flask API для управления стримом
- [`.gitattributes`](https://github.com/kalininlive/vk-tablo-v2/blob/master/.gitattributes) и [`.gitignore`](https://github.com/kalininlive/vk-tablo-v2/blob/master/.gitignore) — корректные окончания строк и защита от утечки секретов

## Быстрые ссылки

- Открыть репозиторий: <https://github.com/kalininlive/vk-tablo-v2>
- `README.md`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/README.md>
- `install.sh`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/install.sh>
- `docker-compose.db.yml`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/docker-compose.db.yml>
- `supabase_setup.sql`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/supabase_setup.sql>
- `api.py`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/api.py>
- `app/src/main.tsx`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/app/src/main.tsx>
- `app/src/AdminPanel.tsx`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/app/src/AdminPanel.tsx>
- `app/src/Overlay.tsx`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/app/src/Overlay.tsx>
- `app/src/useMatchState.ts`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/app/src/useMatchState.ts>
- `app/src/supabase.ts`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/app/src/supabase.ts>

## Требования к серверу

- Ubuntu 22.04
- root-доступ
- Открытые порты: `80`, `443`, `1935`
- Домен с A-записью на IP сервера

## Быстрый запуск (1 команда)

```bash
git clone https://github.com/kalininlive/vk-tablo-v2.git /opt/vk-stream
cd /opt/vk-stream
bash install.sh
```

Скрипт запросит:

1. Домен
2. Логин админ-панели
3. Пароль админ-панели

Секреты (`JWT_SECRET`, `SECRET_KEY_BASE`, `DB_PASSWORD`, `CONTROL_SECRET`) генерируются автоматически при первом запуске и сохраняются только в локальном `.vps.env`.

Что делает `install.sh`:

1. Ставит зависимости (Docker, OBS, Node 20, nginx, certbot, python)
   - автоматически использует `docker compose` или `docker-compose` (что доступно в системе)
2. Поднимает Docker-контейнеры БД/RTMP
3. Инициализирует SQL схему и app_config
4. Ставит systemd сервис `vk-stream-control`
5. Собирает frontend и публикует в `/var/www/vk-stream`
6. Выпускает SSL сертификат и включает nginx reverse proxy

После запуска проверка:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s https://ВАШ_ДОМЕН/stream-control/status
```

Ожидаемые контейнеры в статусе `Up`:

- `vk-postgres`
- `vk-postgrest`
- `vk-realtime`
- `vk-nginx-rtmp`

## Важно

- Файл `.vps.env` создаётся локально и не коммитится.
- Секреты и env-файлы исключены через `.gitignore`.
- В `.vps.env` сохраняется только `ADMIN_PASSWORD_HASH` (без пароля в открытом виде).
