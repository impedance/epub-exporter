// @ts-check
/* global chrome, Dropbox, DROPBOX_CONFIG */
// Dropbox клиент для Chrome Extension
// AICODE-WHY: Encapsulates Dropbox API interactions with proper error handling and token management [2025-08-12]
// AICODE-LINK: ./config.js#DROPBOX_CONFIG

/** @typedef {Object} DropboxToken
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {number} expires_at
 */

class DropboxClient {
    constructor() {
        this.dbx = null;
        this.isLoaded = false;
    }

    /**
     * Загружает Dropbox SDK
     * @returns {Promise<void>}
     */
    async loadSDK() {
        if (this.isLoaded) return;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = DROPBOX_CONFIG.SDK_URL;
            script.onload = () => {
                this.isLoaded = true;
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Dropbox SDK'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Проверяет, подключен ли Dropbox
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        try {
            const tokens = await this.getStoredTokens();
            return tokens && tokens.access_token && !this.isTokenExpired(tokens);
        } catch (error) {
            console.error('Error checking Dropbox connection:', error);
            return false;
        }
    }

    /**
     * Получает сохраненные токены из storage
     * @returns {Promise<DropboxToken|null>}
     */
    async getStoredTokens() {
        const result = await chrome.storage.local.get(['dropboxTokens']);
        return result.dropboxTokens || null;
    }

    /**
     * Сохраняет токены в storage
     * @param {DropboxToken} tokens
     * @returns {Promise<void>}
     */
    async saveTokens(tokens) {
        await chrome.storage.local.set({ dropboxTokens: tokens });
    }

    /**
     * Проверяет, истек ли токен
     * @param {DropboxToken} tokens
     * @returns {boolean}
     */
    isTokenExpired(tokens) {
        return tokens.expires_at && Date.now() > tokens.expires_at;
    }

    /**
     * Авторизация через OAuth 2.0
     * @returns {Promise<boolean>}
     */
    async authorize() {
        try {
            // AICODE-TRAP: chrome.identity API requires proper OAuth 2.0 configuration in manifest.json [2025-08-12]
            const authUrl = `https://www.dropbox.com/oauth2/authorize?` +
                `client_id=${DROPBOX_CONFIG.CLIENT_ID}&` +
                `response_type=code&` +
                `redirect_uri=${encodeURIComponent(DROPBOX_CONFIG.REDIRECT_URL)}`;

            const redirectUrl = await chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true
            });

            if (!redirectUrl) {
                throw new Error('Authorization cancelled');
            }

            const code = this.extractAuthCode(redirectUrl);
            if (!code) {
                throw new Error('Failed to extract authorization code');
            }

            const tokens = await this.exchangeCodeForTokens(code);
            await this.saveTokens(tokens);
            
            await this.initializeClient();
            return true;

        } catch (error) {
            console.error('Dropbox authorization failed:', error);
            throw error;
        }
    }

    /**
     * Извлекает код авторизации из redirect URL
     * @param {string} redirectUrl
     * @returns {string|null}
     */
    extractAuthCode(redirectUrl) {
        const url = new URL(redirectUrl);
        return url.searchParams.get('code');
    }

    /**
     * Обменивает код авторизации на токены
     * @param {string} code
     * @returns {Promise<DropboxToken>}
     */
    async exchangeCodeForTokens(code) {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code: code,
                grant_type: 'authorization_code',
                client_id: DROPBOX_CONFIG.CLIENT_ID,
                redirect_uri: DROPBOX_CONFIG.REDIRECT_URL
            })
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in * 1000)
        };
    }

    /**
     * Инициализирует Dropbox клиент с токенами
     * @returns {Promise<void>}
     */
    async initializeClient() {
        await this.loadSDK();
        
        const tokens = await this.getStoredTokens();
        if (!tokens) {
            throw new Error('No Dropbox tokens available');
        }

        // Обновляем токен если необходимо
        if (this.isTokenExpired(tokens)) {
            await this.refreshTokens();
        }

        const currentTokens = await this.getStoredTokens();
        this.dbx = new Dropbox({ 
            accessToken: currentTokens.access_token,
            fetch: fetch
        });
    }

    /**
     * Обновляет access token используя refresh token
     * @returns {Promise<void>}
     */
    async refreshTokens() {
        const tokens = await this.getStoredTokens();
        if (!tokens || !tokens.refresh_token) {
            throw new Error('No refresh token available');
        }

        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
                client_id: DROPBOX_CONFIG.CLIENT_ID
            })
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        const newTokens = {
            access_token: data.access_token,
            refresh_token: tokens.refresh_token, // Keep existing refresh token
            expires_at: Date.now() + (data.expires_in * 1000)
        };

        await this.saveTokens(newTokens);
    }

    /**
     * Загружает файл в Dropbox
     * @param {Blob} fileBlob - EPUB файл как Blob
     * @param {string} filename - Имя файла
     * @param {Function} [progressCallback] - Callback для прогресса
     * @returns {Promise<string>} - Путь к файлу в Dropbox
     */
    async uploadFile(fileBlob, filename, progressCallback) {
        if (!this.dbx) {
            await this.initializeClient();
        }

        try {
            const path = `${DROPBOX_CONFIG.TARGET_FOLDER}/${filename}`;
            
            // Конвертируем Blob в ArrayBuffer
            const arrayBuffer = await fileBlob.arrayBuffer();
            
            const response = await this.dbx.filesUpload({
                path: path,
                contents: arrayBuffer,
                mode: 'overwrite',
                autorename: true
            });

            console.log('File uploaded to Dropbox:', response.result.path_display);
            return response.result.path_display;

        } catch (error) {
            console.error('Dropbox upload failed:', error);
            throw new Error(`Failed to upload to Dropbox: ${error.message}`);
        }
    }

    /**
     * Отключает Dropbox (удаляет токены)
     * @returns {Promise<void>}
     */
    async disconnect() {
        await chrome.storage.local.remove(['dropboxTokens']);
        this.dbx = null;
        console.log('Dropbox disconnected');
    }

    /**
     * Получает информацию о пользователе
     * @returns {Promise<Object>}
     */
    async getUserInfo() {
        if (!this.dbx) {
            await this.initializeClient();
        }

        try {
            const response = await this.dbx.usersGetCurrentAccount();
            return response.result;
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