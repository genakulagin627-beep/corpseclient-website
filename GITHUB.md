# Гайд: залить CorpseClient на GitHub (v1.0.0)

Репозиторий = **папка `website`** (её корень, не вся «New PROTECT», если там ещё лишние файлы).

> **GitHub Pages** подойдёт только для статики без API. Полный сайт (логин, чат, админка) нужен **сервер с Node.js** (VPS, Render, Railway и т.п.).

---

## 1. Перед заливкой

- [ ] В репозиторий **не попадают**: `backend/.env`, `backend/data/*.db`, `node_modules/`, пароли.
- [ ] В репозиторий **попадают**: `.env.example`, код, `VERSION`, `README.md`.
- [ ] Смени `JWT_SECRET` и пароль админа на сервере после деплоя.

---

## 2. Создать репозиторий на GitHub

1. https://github.com/new  
2. Имя, например: `corpseclient-website`  
3. **Private** (рекомендуется) или Public  
4. Без README / .gitignore (они уже в проекте)  
5. **Create repository**

---

## 3. Залить код (PowerShell)

**Один раз** укажи имя для Git (подставь свой email с GitHub):

```powershell
git config user.name "Ваше Имя"
git config user.email "ваш@email.com"
```

```powershell
cd "C:\Users\Home\Desktop\освнова\New PROTECT\website"

git init
git add .
git status
```

Проверь, что в списке **нет** `.env` и `*.db`. Если есть — они в `.gitignore`, сделай `git rm --cached` для них.

```powershell
git commit -m "release: CorpseClient website v1.0.0"
```

Отдельной строкой (не склеивай с предыдущей командой):

```powershell
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ-РЕПО.git
git push -u origin main
```

Замени **`ВАШ_ЛОГИН`** и **`ВАШ-РЕПО`** на реальные значения с GitHub.  
Строку `ТВОЙ_ЛОГИН/ИМЯ-РЕПО` из примера **нельзя** вставлять как есть.

Если remote уже добавлен с ошибкой:

```powershell
git remote remove origin
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ-РЕПО.git
```

При первом push GitHub попросит войти (браузер или [Personal Access Token](https://github.com/settings/tokens)).

---

## 4. Тег версии (релиз на GitHub)

```powershell
git tag -a v1.0.0 -m "CorpseClient website 1.0.0"
git push origin v1.0.0
```

На GitHub: **Releases → Draft a new release →** выбери тег `v1.0.0`, опиши изменения, **Publish**.

---

## 5. Клонировать у себя / на сервере

```bash
git clone https://github.com/ТВОЙ_ЛОГИН/corpseclient-website.git
cd corpseclient-website
npm run install:all
copy backend\.env.example backend\.env
copy frontend-admin\.env.example frontend-admin\.env
```

Настрой `backend\.env`, затем:

```bash
npm run dev
```

Админка (отдельно): `npm run dev:admin`

---

## 6. Деплой на VPS (кратко)

1. Установи Node 22+ на сервер.  
2. Клонируй репо, `npm run install:all`, создай `.env`.  
3. Собери админку:  
   `cd frontend-admin && npm run build`  
4. Запуск API:  
   `cd backend && node src/server.js`  
   или **pm2**: `pm2 start src/server.js --name corpse-api`  
5. **Nginx**: прокси на `127.0.0.1:3000`, статика из корня `website/`.  
6. В `frontend-admin/.env` для продакшена:  
   `VITE_API_BASE=https://твой-домен.ru`  
   и пересобери `npm run build`.

Порт занят (`EADDRINUSE`):

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 7. Что в версии 1.0.0

- Сайт CorpseClient (RU/EN), регистрация, профиль, чат  
- API + SQLite (`node:sqlite`, Node 22.5+)  
- React-админка (пользователи, ключи, тема)  
- Лаунчер в `lan/` (отдельно, тяжёлый — в `.gitignore` только `lan/node_modules`)

---

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| `EADDRINUSE :3000` | Убить старый `node` или сменить `API_PORT` в `.env` |
| SQLite / Node | Нужен Node **≥ 22.5** |
| Админка не логинится | Запущен ли `npm run dev` (backend)? |
| Секреты в GitHub | Удали `.env` из истории, смени `JWT_SECRET` |
