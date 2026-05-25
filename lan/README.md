# CorpseClient Launcher

Electron-лаунчер, подключённый к сайту **https://corpseclient.onrender.com**.

## Что делает

- Вход / регистрация — те же аккаунты, что на сайте (`/api/auth/login`, `/api/auth/register`)
- Проверка подписки — `/api/launcher/me` (поле `subscription_until` в БД)
- **Play (1.16.5 Fabric):** скачивает сборку Minecraft с workupload → случайная папка в `%APPDATA%` → качает mod `.jar` в `mods/` → запуск
- Прогресс загрузки на экране (фаза, байты, %)
- Сессия для чита — `inprotect-session.json` + подпись HMAC

Ссылки по умолчанию (можно переопределить на Render: `MC_PACK_URL`, `MOD_JAR_URL`):

- Сборка: https://workupload.com/file/DfDbfTtSUsz  
- Мод: https://workupload.com/file/BLmQgMPqCXW

## Запуск

```bash
cd lan
npm install
npm start
```

API по умолчанию: `https://corpseclient.onrender.com/api`  
Локальный бэкенд: задай `LAUNCHER_USE_LOCAL_API=1` и в настройках (PIN) URL `http://localhost:3000/api`.

## Активировать подписку

На сайте: профиль → ключ лицензии, или админка на Render / в профиле (админ).

## Сборка exe (для кнопки «Скачать лаунчер» на сайте)

```bash
npm run dist
```

Скопируй `lan/dist/Launcher-*.exe` в `website/uploads/launcher/` или задай `LAUNCHER_DOWNLOAD_URL` на Render.
