// @ts-check
/* global chrome */
// Simplified Dropbox client for single-user Chrome Extension
// AICODE-WHY: No OAuth needed for single user - use hardcoded refresh token like tg2book [2025-08-12]
// AICODE-LINK: ./config.js#DROPBOX_CONFIG

const CONFIG = (() => {
    if (typeof DROPBOX_CONFIG !== 'undefined') {
        return DROPBOX_CONFIG;
    }
    if (typeof globalThis !== 'undefined' && globalThis.DROPBOX_CONFIG) {
        return globalThis.DROPBOX_CONFIG;
    }
    throw new Error('DROPBOX_CONFIG is not defined. Ensure config.js is loaded before dropbox_client.js');
})();

class DropboxClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = null;
    }

    /**
     * Получает действующий access token (обновляет если нужно)
     * @returns {Promise<string>}
     */
    async getAccessToken() {
        // Если токен есть и не истек - возвращаем его
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        // Обновляем токен
        await this.refreshAccessToken();
        return this.accessToken;
    }

    /**
     * Обновляет access token используя refresh token
     * @returns {Promise<void>}
     */
    async refreshAccessToken() {
        const url = 'https://api.dropbox.com/oauth2/token';
        
        const formData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: CONFIG.REFRESH_TOKEN
        });

        const auth = btoa(`${CONFIG.APP_KEY}:${CONFIG.APP_SECRET}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        
        console.log('Dropbox access token refreshed');
    }

    /**
     * Проверяет, настроен ли Dropbox (есть ли все необходимые ключи)
     * @returns {boolean}
     */
    isConfigured() {
        return !!(CONFIG.APP_KEY &&
                  CONFIG.APP_SECRET &&
                  CONFIG.REFRESH_TOKEN &&
                  CONFIG.APP_KEY !== 'your_dropbox_app_key_here');
    }

    /**
     * Проверяет подключение к Dropbox и валидность конфигурации
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        if (!this.isConfigured()) {
            return false;
        }
        try {
            await this.getUserInfo();
            return true;
        } catch (error) {
            // AICODE-TRAP: Ошибки сети или токена считаем отсутствием подключения [2025-02-14]
            console.error('Dropbox connection check failed:', error);
            return false;
        }
    }

    /**
     * Загружает файл в Dropbox
     * @param {Blob} fileBlob - EPUB файл как Blob
     * @param {string} filename - Имя файла
     * @returns {Promise<string>} - Путь к файлу в Dropbox
     */
    async uploadFile(fileBlob, filename) {
        if (!this.isConfigured()) {
            throw new Error('Dropbox не настроен. Проверьте config.js');
        }

        try {
            const accessToken = await this.getAccessToken();
            const path = `${CONFIG.TARGET_FOLDER}/${filename}`;
            
            // Конвертируем Blob в ArrayBuffer
            const arrayBuffer = await fileBlob.arrayBuffer();
            
            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: path,
                        mode: 'overwrite',
                        autorename: true
                    })
                },
                body: arrayBuffer
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            console.log('File uploaded to Dropbox:', result.path_display);
            return result.path_display;

        } catch (error) {
            console.error('Dropbox upload failed:', error);
            throw new Error(`Failed to upload to Dropbox: ${error.message}`);
        }
    }

    /**
     * Получает информацию о текущем пользователе (для отображения в UI)
     * @returns {Promise<Object>}
     */
    async getUserInfo() {
        if (!this.isConfigured()) {
            throw new Error('Dropbox не настроен');
        }

        try {
            const accessToken = await this.getAccessToken();
            
            const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: 'null'
            });

            if (!response.ok) {
                throw new Error(`Failed to get user info: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get user info:', error);
            throw error;
        }
    }
}

// Создаем глобальный экземпляр
if (typeof window !== 'undefined') {
    window.dropboxClient = new DropboxClient();
}

export default DropboxClient;
