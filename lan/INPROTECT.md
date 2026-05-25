# Папка C:\InProtect

Лаунчер качает клиент **на диск C:** в фиксированную папку (не в AppData).

## Структура

```
C:\InProtect\
  corpse-1.0.0.jar      ← мод/клиент (запускается через java -jar)
  pack.zip              ← скачанная сборка Fabric
  game\                 ← распакованный 1.21.4.zip
  mods\                 ← копия jar для Fabric
  inprotect-session.json
  inprotect-session.sig
```

## Как запускается Play

1. Скачать `corpse-1.0.0.jar` с Dropbox (или с API сервера).
2. Скачать и распаковать `1.21.4.zip` в `C:\InProtect\game`.
3. Скопировать jar в `game\mods` (если есть папка mods).
4. Запустить: `java -jar C:\InProtect\corpse-1.0.0.jar`

## Нужна Java

Установи **JDK 17+** (или JRE). В PATH должна работать команда:

```powershell
java -version
```

## Если «ничего не запускается»

- Открой `C:\InProtect` в проводнике — там должны быть jar и папка `game`.
- Проверь Java в терминале.
- Вручную:

```powershell
cd C:\InProtect
java -jar corpse-1.0.0.jar
```

## Render (ссылки)

- `MC_PACK_URL` — zip сборки (Dropbox `dl=1`)
- `MOD_JAR_URL` — jar мода (Dropbox `dl=1`)
