# Chrome расширение для экспорта в EPUB

Полнофункциональное Chrome расширение для извлечения контента из веб-страниц и конвертации в формат EPUB, оптимизированный для PocketBook и других электронных читалок.

## For coding agents (read first)
- Start with `AGENTS.md` for repo protocol.
- Read `docs/context.md` and `docs/status.md`.
- Use `rg -n "AICODE-" .` to navigate anchors.

## Repository layout
- `manifest.json` — extension wiring, permissions, scripts; `rg -n "manifest_version" manifest.json`
- `content_script.js` — selection extraction entry point; `rg -n "AICODE-" content_script.js`
- `background.js` — EPUB creation + image fetch fallback; `rg -n "AICODE-" background.js`
- `extractContent.js` — tab messaging + content script injection; `rg -n "extractContent" extractContent.js`
- `epub_generator.js` — EPUB structure + JSZip integration; `rg -n "createEPUB" epub_generator.js`
- `epub/` — templates + asset helpers; `rg -n "get.*Template" epub/`
- `popup.html` / `popup.js` — UI flow; `rg -n "export" popup.js`
- `dropbox_client.js` / `gmail_client.js` / `config.js` — Dropbox/Gmail upload + config; `rg -n "Dropbox|Gmail" dropbox_client.js gmail_client.js config.js`
- `test/` — test suites and guidance; `rg -n "Running Tests" test/README.md`
- `test/core/` — 80/20 contract suite; `rg -n "Core suite" test/README.md`
- `test/full/` — extended regression suite
- `docs/` — context, status, decisions, templates
- `scripts/` — repo tooling (AICODE linter)

## Entry points
- `content_script.js` — selection extraction flow (`AICODE-NOTE: NAV/CONTENT`)
- `background.js` — EPUB build and image normalization (`AICODE-NOTE: NAV/BACKGROUND`)
- `popup.js` — UI orchestration
- `extractContent.js` — content script injection + messaging
- `epub_generator.js` — EPUB building and templates
- `dropbox_client.js` — Dropbox upload path
- `gmail_client.js` — Gmail API export path

## Common tasks
- `npm run lint:aicode`
- `npm test`
- `npm run test:core`
- `npm run test:full`
- `npm run test:verbose`
- `npm run test:functions`
- `npm run typecheck`

## Search cookbook
- `rg -n "AICODE-" .`
- `rg -n "extractSelectedContent" content_script.js`
- `rg -n "extractPageContent" content_script.js extractContent.js`
- `rg -n "createEPUB" background.js epub_generator.js`
- `rg -n "JSZip" background.js epub_generator.js`
- `rg -n "Dropbox" dropbox_client.js config.js popup.js`
- `rg -n "fetchImage" background.js content_script.js`
- `rg -n "Selection" content_script.js test/`
- `rg -n "manifest_version" manifest.json`
- `rg -n "test:" package.json test/README.md`

## 🚀 Возможности

- **Экспорт выделенного текста** — пользователь выделяет нужный контент, и он попадает в EPUB
- **Поддержка изображений** с конвертацией в base64 и встраиванием в EPUB
- **Умная очистка контента** от навигации, рекламы и лишних элементов
- **Отправка на Kindle** — прямая отправка EPUB в читалку через Gmail API
- **Оптимизация для PocketBook** с читаемыми CSS стилями
- **Полностью валидный EPUB** формат с правильной структурой
- **Простой интерфейс** с прогресс-индикатором

## 🛠️ Установка

### Способ 1: Загрузка как unpacked extension

1. **Скачайте все файлы** в отдельную папку на компьютере
2. **Откройте Chrome** и перейдите в `chrome://extensions/`
3. **Включите режим разработчика** (Developer mode) в правом верхнем углу
4. **Нажмите "Load unpacked"** и выберите папку с файлами расширения
5. **Расширение установлено!** Иконка появится в панели инструментов

### Способ 2: Создание .crx пакета

```bash
# 1. Упакуйте файлы в ZIP архив
zip -r epub-exporter.zip manifest.json popup.html popup.js content_script.js background.js epub_generator.js

# 2. Переименуйте .zip в .crx
mv epub-exporter.zip epub-exporter.crx

# 3. Установите через chrome://extensions/
```

## 🎯 Использование

1. **Откройте веб-страницу** с нужным материалом
2. **Выделите текст** и связанные элементы (изображения, списки)
3. **Нажмите на иконку расширения** в панели инструментов
4. **Нажмите "Экспорт в EPUB"** в popup окне
5. **Дождитесь завершения** экспорта (прогресс отображается в popup)
6. **EPUB файл автоматически загрузится** в папку Downloads

### Что извлекается

- **Заголовки** (h1, h2, h3, h4, h5, h6)
- **Текстовые абзацы** (p)
- **Списки** (ul, ol, li)
- **Цитаты** (blockquote)
- **Код** (pre, code)
- **Изображения** (img) с конвертацией в base64

### Что удаляется

- Навигационные элементы (nav, header, footer)
- Реклама (ads, advertisement)
- Социальные кнопки (social-share)
- Комментарии (comments)
- Скрипты и стили (script, style)

## ⚙️ Технические детали

### Библиотеки

- **JSZip 3.10.1** - создание ZIP архивов (EPUB формат)
- Загружается с CDN: `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`

### EPUB структура

```
book.epub
├── mimetype                  # MIME тип файла
├── META-INF/
│   └── container.xml        # Конфигурация контейнера
└── OEBPS/
    ├── content.opf          # Метаданные и манифест
    ├── toc.ncx             # Навигация
    ├── chapter1.xhtml      # Основной контент
    ├── styles.css          # CSS стили
    └── images/             # Изображения
        ├── img_1.jpg
        └── img_2.png
```

### Совместимость

- ✅ **PocketBook** (все модели)
- ✅ **Kindle** (с конвертацией через Calibre)
- ✅ **Adobe Digital Editions**
- ✅ **Readium** и другие EPUB ридеры
- ✅ **Мобильные приложения** (Moon+ Reader, FBReader)

## 🔧 Разработка и настройка

### Модификация CSS стилей

Отредактируйте функцию `getStylesTemplate()` в `epub/templates/styles.js`.

### Настройка логики выделения

Основная логика извлечения находится в `extractSelectedContent()` внутри `content_script.js`.

### Настройка Dropbox

1. Скопируйте файл `.env.example` в `.env`.
2. Укажите значения `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` и при необходимости `DROPBOX_TARGET_FOLDER`.
3. Держите `.env` вне Git (файл уже добавлен в `.gitignore`).
4. При загрузке расширения убедитесь, что `.env` находится рядом с `manifest.json` — фоновые скрипты прочитают его автоматически.

### Настройка Kindle (через Gmail API)

1. Укажите свой `GMAIL_CLIENT_ID` (полученный в Google Cloud Console) в `.env` файле.
2. Укажите `KINDLE_EMAIL` (адрес вашего устройства @kindle.com) в `.env`.
3. Добавьте ваш адрес Gmail в список разрешенных отправителей в настройках Amazon Kindle ("Personal Document Settings").
4. При первой отправке разрешите доступ во всплывающем окне Google.

## 🐛 Устранение неисправностей

### Расширение не активируется

1. Проверьте, что все файлы находятся в одной папке
2. Убедитесь, что `manifest.json` корректный
3. Перезагрузите расширение в `chrome://extensions/`

### Контент не извлекается

1. Откройте DevTools (F12) и проверьте консоль на ошибки
2. Убедитесь, что выделение действительно содержит текст
3. Попробуйте выделить контент без посторонних элементов интерфейса

### EPUB файл не создается

1. Проверьте доступность JSZip CDN
2. Убедитесь, что браузер разрешает загрузки
3. Проверьте консоль background script

## 🤝 Участие в разработке

1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения
4. Протестируйте на разных сайтах
5. Создайте Pull Request

## 📞 Поддержка

1. Проверьте раздел "Устранение неисправностей"
2. Откройте DevTools и изучите ошибки в консоли
3. Создайте Issue с подробным описанием проблемы

## 📝 Лицензия

MIT License - свободное использование и модификация.
