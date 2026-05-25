# Хостинг: GitHub Pages + API на Render

Полный проект **не влезает только в GitHub Pages** — там нет Node.js. Схема:

| Часть | Где | URL |
|--------|-----|-----|
| Сайт (HTML) | **GitHub Pages** | `https://genakulagin627-beep.github.io/corpseclient-website/` |
| API, чат, БД | **Render** (бесплатно) | `https://твой-сервис.onrender.com` |
| Админка | GitHub Pages `/admin/` | `.../corpseclient-website/admin/` |

---

## Шаг 1 — API на Render (5–10 мин)

1. Зайди на https://render.com → **Sign Up** (можно через GitHub).
2. **New +** → **Web Service** → репозиторий `corpseclient-website`.
3. Настройки:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Instance:** Free
4. **Environment Variables:**

   | Key | Value |
   |-----|--------|
   | `JWT_SECRET` | длинная случайная строка |
   | `CORS_ORIGIN` | `https://genakulagin627-beep.github.io` |
   | `ADMIN_EMAIL` | `admin@inprotect.local` |
   | `ADMIN_PASSWORD` | свой пароль |
   | `ADMIN_NAME` | `Admin` |

5. **Create Web Service** — дождись **Live**.
6. Скопируй URL, например: `https://corpseclient-api.onrender.com`
7. Проверка: открой `https://ТВОЙ-URL.onrender.com/health` → `{"ok":true}`

> Free на Render «засыпает» — первый запрос после простоя 30–60 сек.

---

## Шаг 2 — GitHub Pages (сайт)

1. Репозиторий: https://github.com/genakulagin627-beep/corpseclient-website  
2. **Settings** → **Pages**  
3. **Build and deployment** → Source: **GitHub Actions** (не «Deploy from branch»).  
4. **Settings** → **Secrets and variables** → **Actions** → вкладка **Variables**  
5. **New repository variable:**
   - Name: `PUBLIC_API_URL`
   - Value: `https://corpseclient-api.onrender.com` (твой URL с Render, **без** слэша в конце)
6. Закоммить и запушить workflow (уже в репо: `.github/workflows/github-pages.yml`):

```powershell
cd "C:\Users\Home\Desktop\освнова\New PROTECT\website"
git add .
git commit -m "ci: GitHub Pages + Render deploy"
git push origin main
```

7. Вкладка **Actions** — workflow **Deploy GitHub Pages** → зелёная галочка.  
8. Сайт: **https://genakulagin627-beep.github.io/corpseclient-website/**  
9. Админка: **https://genakulagin627-beep.github.io/corpseclient-website/admin/**

Логин админки — тот же email/пароль, что в `ADMIN_*` на Render.

---

## Шаг 3 — Проверка

- Главная открывается, тема грузится.  
- Регистрация / вход работают (идут на Render).  
- Чат подключается (WebSocket на API).  
- `/admin/` — панель управления.

Если «сеть» / CORS — проверь `CORS_ORIGIN` на Render (точно `https://genakulagin627-beep.github.io`).

---

## Обновление сайта

```powershell
git add .
git commit -m "update site"
git push origin main
```

Pages и API обновятся сами (Actions + Render auto-deploy).

---

## Только VPS (всё на одном сервере)

Если нужен один сервер без Render — см. раздел **6** в [GITHUB.md](./GITHUB.md): `npm run install:all`, `.env`, nginx, pm2.

---

## Частые проблемы

| Симптом | Решение |
|---------|---------|
| Сайт есть, логин не работает | Нет `PUBLIC_API_URL` или неверный URL Render |
| CORS error | `CORS_ORIGIN` на Render = GitHub Pages origin |
| API долго отвечает | Render free cold start — подожди |
| 404 на `/admin/` | Дождись успешного Actions deploy |
