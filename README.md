# CorpseClient Website v1.0.0

Сайт, API (Node.js), админ-панель (React) и лаунчер (`lan/`).

## Требования

- **Node.js 22.5+** или **24.x** (нужен встроенный `node:sqlite`)
- npm

## Быстрый старт

```bash
cd website
npm run install:all
```

Скопируй конфиги:

```bash
copy backend\.env.example backend\.env
copy frontend-admin\.env.example frontend-admin\.env
```

Отредактируй `backend\.env` — минимум `JWT_SECRET` (длинная случайная строка).

**Терминал 1 — сайт + API:**

```bash
npm run dev
```

→ http://localhost:3000

**Терминал 2 — админка:**

```bash
npm run dev:admin
```

→ http://localhost:5173

**Админ по умолчанию** (создаётся при первом запуске, если нет в БД):

| | |
|---|---|
| Email | `admin@inprotect.local` |
| Пароль | `admin12345` |

Смени в `backend\.env` перед продакшеном.

## Структура

| Папка | Назначение |
|--------|------------|
| `*.html`, `*.css`, `*.js` | Публичный сайт |
| `backend/` | API, БД, чат WebSocket |
| `frontend-admin/` | React-админка |
| `lan/` | Electron-лаунчер (опционально) |

## Версия

См. файл `VERSION` — сейчас **1.0.0**.

## GitHub

Как залить репозиторий — **[GITHUB.md](./GITHUB.md)**.

## Хостинг (сайт на GitHub Pages + API)

Пошагово: **[DEPLOY-HOSTING.md](./DEPLOY-HOSTING.md)** — Pages + бесплатный Render.
