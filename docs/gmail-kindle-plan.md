# Gmail API Integration: Send to Kindle

> План внедрения функционала отправки EPUB на Kindle через Gmail API

## Обзор

Добавление возможности отправки EPUB на Kindle через Gmail API по образцу существующей Dropbox интеграции.

**Общее время**: ~9-11 часов | **Задачи**: 8 фаз

## Предварительные требования

### Google Cloud Console
1. Создать проект: [console.cloud.google.com](https://console.cloud.google.com)
2. Включить Gmail API
3. Настроить OAuth consent screen
4. Создать OAuth 2.0 Client ID для Chrome Extension
5. Скопировать Client ID

### Amazon Kindle
- Добавить Gmail адрес в whitelist: [Amazon Manage Devices](https://www.amazon.com/hz/mycd/myx#/home/settings/payment)

## Новые файлы

| Файл | Назначение |
|------|------------|
| `gmail_client.js` | OAuth + отправка email через Gmail API |
| `test/gmail_client.test.mjs` | Unit тесты для Gmail клиента |
| `test/integration_export.test.mjs` | Интеграционные тесты export flow |

## Модифицируемые файлы

| Файл | Изменения |
|------|-----------|
| `.env.example` | Добавить `GMAIL_CLIENT_ID`, `KINDLE_EMAIL` |
| `config.js` | Добавить `loadGmailConfig()` |
| `manifest.json` | Добавить `identity` permission, `oauth2` секцию |
| `popup.html` | Добавить Kindle секцию |
| `popup.js` | Добавить Gmail status, Send to Kindle flow |
| `test/popup.test.mjs` | Добавить smoke-тесты для dual-client |

## Задачи

| # | Задача | Время | Зависимости |
|---|--------|-------|-------------|
| 1 | Google Cloud Console setup | 1-2ч | — |
| 2 | Расширить `config.js` + `.env.example` | 1ч | — |
| 3 | Создать `gmail_client.js` | 1.5-2ч | #1, #2 |
| 4 | Обновить `manifest.json` | 30мин | #1 |
| 5 | Расширить `popup.html/js` | 1.5-2ч | #3, #4 |
| 6a | **Regression тесты** | 1ч | #5 |
| 6b | Gmail client тесты | 1ч | #3 |
| 7 | Ручное E2E тестирование | 30мин | #6a, #6b |
| 8 | Документация + AICODE anchors | 30мин | #5 |

## Стратегия тестирования (Золотая середина)

### Автоматические тесты
1. **Integration test: Download only** — popup → extract → EPUB → download
2. **Regression test: Dropbox upload** — проверка что Dropbox продолжает работать
3. **Integration test: Send to Kindle** — popup → extract → EPUB → gmail.send

### Smoke тесты
- Popup инициализация с обоими клиентами (Dropbox + Gmail)

### Ручное тестирование
- OAuth flow в Chrome
- Отправка на тестовый email
- Отправка на Kindle

## Ссылки

- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [chrome.identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Amazon Send to Kindle](https://www.amazon.com/sendtokindle)
