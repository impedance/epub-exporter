// @ts-check
// Конфигурация для Dropbox интеграции
// AICODE-WHY: Simple hardcoded config for single-user Chrome extension, no OAuth needed [2025-08-12]

const DROPBOX_CONFIG = {
    // Ваши Dropbox credentials (заполните из .env файла tg2book)
    APP_KEY: '',
    APP_SECRET: '',
    REFRESH_TOKEN:'',
    
    // Папка назначения в Dropbox
    TARGET_FOLDER: '/Apps/EPUB Exporter'
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.DROPBOX_CONFIG = DROPBOX_CONFIG;
}

const globalTarget = typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof self !== 'undefined' ? self : undefined);

if (globalTarget && !globalTarget.DROPBOX_CONFIG) {
    globalTarget.DROPBOX_CONFIG = DROPBOX_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DROPBOX_CONFIG;
}
