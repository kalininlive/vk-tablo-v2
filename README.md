# VK Tablo v2

Минимальный репозиторий для развёртывания серверной инфраструктуры VK-трансляций на Ubuntu 22.04.

## Что в репозитории

- [`install.sh`](https://github.com/kalininlive/vk-tablo-v2/blob/master/install.sh) — установщик инфраструктуры (один запуск)
- [`docker-compose.db.yml`](https://github.com/kalininlive/vk-tablo-v2/blob/master/docker-compose.db.yml) — PostgreSQL + PostgREST + Realtime + RTMP
- [`supabase_setup.sql`](https://github.com/kalininlive/vk-tablo-v2/blob/master/supabase_setup.sql) — схема БД и RLS
- [`.gitattributes`](https://github.com/kalininlive/vk-tablo-v2/blob/master/.gitattributes) и [`.gitignore`](https://github.com/kalininlive/vk-tablo-v2/blob/master/.gitignore) — корректные окончания строк и защита от утечки секретов

## Быстрые ссылки

- Открыть репозиторий: <https://github.com/kalininlive/vk-tablo-v2>
- `README.md`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/README.md>
- `install.sh`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/install.sh>
- `docker-compose.db.yml`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/docker-compose.db.yml>
- `supabase_setup.sql`: <https://github.com/kalininlive/vk-tablo-v2/blob/master/supabase_setup.sql>

## Требования к серверу

- Ubuntu 22.04
- root-доступ
- Открытые порты: `80`, `443`, `1935`
- Домен с A-записью на IP сервера

## Быстрый запуск

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

После запуска проверка:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
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
