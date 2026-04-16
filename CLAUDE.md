# VK Tablo v2 — Инструкции для Claude

## Правила работы (ОБЯЗАТЕЛЬНО)

1. **Не отмечать задачу выполненной** без явного подтверждения пользователя («ок», «работает», «принято» и т.п.)
2. **После каждого изменения** обновлять `memory/workplan.md` — что сделано, что нет
3. **Перед каждой сессией** читать `memory/workplan.md` и `memory/project_context.md`
4. **Удалять устаревшее** из memory-файлов если статус изменился
5. **Думать на английском, писать пользователю на русском** — всегда
6. **Деплой после пуша** — напоминать команду обновления сервера (см. ниже)

## Деплой на сервер (obs.kalininlive.ru)

```bash
# Фронтенд (изменения в app/src/)
cd /opt/vk-stream && git pull && cd app && npm run build && cp -r dist/* /var/www/vk-stream/

# Бэкенд (изменения в api.py)
cd /opt/vk-stream && git pull && sudo systemctl restart vk-stream-api

# Полное обновление
cd /opt/vk-stream && git pull && cd app && npm run build && cp -r dist/* /var/www/vk-stream/ && sudo systemctl restart vk-stream-api
```

**Важно:** nginx берёт файлы из `/var/www/vk-stream/`. Без `cp` изменения не применяются.

## Архитектура проекта

| Что | Где |
|-----|-----|
| Репозиторий на сервере | `/opt/vk-stream/` |
| Сборка фронтенда | `/opt/vk-stream/app/dist/` |
| Nginx отдаёт | `/var/www/vk-stream/` |
| Flask API | порт 5000, `systemctl: vk-stream-api` |
| PostgreSQL | Docker, порт 5432 |
| PostgREST | Docker, порт 3000 → `/rest/v1/` |
| Supabase Realtime | Docker, порт 4000 → `/realtime/v1/` |

## Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `app/src/AdminPanel.tsx` | Вся админка (вкладки: Эфир, Матч, Дизайн, Медиатека, FX, Доступ) |
| `app/src/Overlay.tsx` | Оверлей для OBS Browser Source |
| `app/src/useMatchState.ts` | Хуки: состояние матча, настройки, медиа, каналы |
| `app/src/types.ts` | TypeScript типы + defaultMatchState |
| `app/src/scoreboards/` | Компоненты табло: Classic, Stadium, Flat, Neon |
| `api.py` | Flask: start/stop OBS, patch match state |
| `supabase_setup.sql` | Схема БД |
| `docker-compose.db.yml` | Docker-сервисы |
| `memory/workplan.md` | **Текущий план работ — читать в начале сессии** |

## Стек

- React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion
- Supabase JS (WebSocket realtime на postgres_changes)
- Flask (Python) + psycopg2 + threading.Lock
- PostgreSQL 15 + PostgREST + Supabase Realtime (Docker)
- OBS + Xvfb headless + nginx-rtmp

## Типы данных (важные изменения)

- `goalAnimation.goalId` — **string** (crypto.randomUUID()), не number
- `cardEvent.cardId` — **string** (crypto.randomUUID()), не number  
- `introScreen.startedAt` — **number | null** — timestamp включения интро
