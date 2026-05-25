# CorpseClient Launcher

Electron-лаунчер, подключённый к сайту **https://corpseclient.onrender.com**.

## Что делает

- Вход / регистрация — те же аккаунты, что на сайте (`/api/auth/login`, `/api/auth/register`)
- Проверка подписки — `/api/launcher/me` (поле `subscription_until` в БД)
- **Play (1.21.4 Fabric):** качает jar и zip в **`C:\InProtect`** → распаковка в `game\` → `java -jar corpse-1.0.0.jar`

Подробно: [INPROTECT.md](./INPROTECT.md)
- Прогресс загрузки на экране (фаза, байты, %)
- Сессия для чита — `inprotect-session.json` + подпись HMAC

Загрузка идёт через API сервера (`/api/launcher/download-pack` и `download-mod`), не напрямую с workupload.

**Если ошибка workupload / «прямая ссылка»** — на Render задай **прямые** URL (файл .zip / .jar), не страницу workupload:

- `MC_PACK_URL` — ссылка на zip сборки  
- `MOD_JAR_URL` — ссылка на mod.jar  

Или залей на сервер в `uploads/game/`: `minecraft-pack.zip` и `mod.jar`.

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

**Перед сборкой закрой лаунчер** (`npm start` / окно Electron).

```bash
npm run dist
```

Скрипт `predist` сам завершит `electron.exe` и очистит папку `dist/`.

Скопируй `lan/release/Launcher-*.exe` в `website/uploads/launcher/` или задай `LAUNCHER_DOWNLOAD_URL` на Render.

Старая папка `lan/dist/` можно удалить вручную, когда ничего не держит `app.asar` (закрой Cursor/проводник в этой папке).

## «Путь не задан» при Play

Старая сохранённая конфигурация без `cloudInstall`. Перезапусти лаунчер после обновления — конфиг подтянется сам. Для 1.16.5 путь в настройках **не нужен**: идёт загрузка с workupload.
