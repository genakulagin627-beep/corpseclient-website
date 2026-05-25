# C:\InProtect — Minecraft 1.21.4 Fabric

## Кнопки в лаунчере

| Кнопка | Действие |
|--------|----------|
| **Скачать** | Один раз: качает `1.21.4.zip` и распаковывает в `C:\InProtect\minecraft` |
| **Играть** | Кладёт `corpse-1.0.0.jar` в папку `mods` и запускает Minecraft из сборки |

Повторно Minecraft **не качается**, если уже установлен.

## Папки

```
C:\InProtect\
  1.21.4.zip           ← архив (кэш)
  minecraft\           ← распакованный Fabric
  corpse-1.0.0.jar     ← кэш мода
  install-state.json
```

Мод при запуске копируется в `minecraft\...\mods\corpse-1.0.0.jar`.

## Переустановить

Удали `C:\InProtect` или только `install-state.json` + `minecraft`, потом снова **Скачать**.
