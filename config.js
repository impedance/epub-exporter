// @ts-check
// Конфигурация для Dropbox интеграции
// AICODE-WHY: Centralized configuration allows easy management of Dropbox settings and API keys [2025-08-12]

const DROPBOX_CONFIG = {
    // Замените на ваш App Key из Dropbox App Console
    CLIENT_ID: 'your_dropbox_app_key_here',
    
    // Автоматически генерируемый redirect URL для Chrome Extension
    REDIRECT_URL: typeof chrome !== 'undefined' ? chrome.identity.getRedirectURL() : '',
    
    // Папка назначения в Dropbox
    TARGET_FOLDER: '/Apps/EPUB Exporter',
    
    // Scopes для Dropbox API
    SCOPES: ['files.content.write'],
    
    // Dropbox SDK URL
    SDK_URL: 'https://cdnjs.cloudflare.com/ajax/libs/dropbox/10.34.0/Dropbox-sdk.min.js'
};

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.DROPBOX_CONFIG = DROPBOX_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DROPBOX_CONFIG;
}