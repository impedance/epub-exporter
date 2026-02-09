// @ts-check
/* global chrome */
// Simplified Dropbox client for single-user Chrome Extension
// AICODE-NOTE: DECISION/DROPBOX-AUTH decision: single-user extension uses a refresh token without full OAuth flow.
// AICODE-LINK: ./config.js#loadDropboxConfig

import { loadDropboxConfig } from './config.js';

const LOG_PREFIX = '[dropbox]';

class DropboxClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = null;
        this.configPromise = null;
        this.cachedConfig = null;
        console.debug(`${LOG_PREFIX} client initialized`);
    }

    /**
     * Получает действующий access token (обновляет если нужно)
     * @returns {Promise<string>}
     */
    async getAccessToken() {
        const config = await this.ensureConfigured();

        // Если токен есть и не истек - возвращаем его
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            console.debug(`${LOG_PREFIX} reuse cached access token (valid until ${new Date(this.tokenExpiresAt).toISOString()})`);
            return this.accessToken;
        }

        console.debug(`${LOG_PREFIX} refreshing access token`);
        // Обновляем токен
        await this.refreshAccessToken(config);
        if (this.tokenExpiresAt) {
            console.debug(`${LOG_PREFIX} new token valid until ${new Date(this.tokenExpiresAt).toISOString()}`);
        }
        return this.accessToken;
    }

    /**
     * Обновляет access token используя refresh token
     * @param {{APP_KEY: string, APP_SECRET: string, REFRESH_TOKEN: string}} config
     * @returns {Promise<void>}
     */
    async refreshAccessToken(config) {
        const url = 'https://api.dropbox.com/oauth2/token';
        console.debug(`${LOG_PREFIX} requesting token via ${url}`);

        const formData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: config.REFRESH_TOKEN
        });

        const auth = btoa(`${config.APP_KEY}:${config.APP_SECRET}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`${LOG_PREFIX} token refresh failed`, response.status, response.statusText, errorText);
            throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

        console.debug(`${LOG_PREFIX} access token refreshed successfully`);
    }

    /**
     * Проверяет, настроен ли Dropbox (есть ли все необходимые ключи)
     * @returns {Promise<boolean>}
     */
    async isConfigured() {
        const config = await this.getConfig();
        const configured = DropboxClient.isConfigValid(config);
        if (!configured) {
            console.warn(`${LOG_PREFIX} configuration missing or placeholder values detected`);
        }
        return configured;
    }

    /**
     * Проверяет подключение к Dropbox и валидность конфигурации
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        const config = await this.getConfig();
        if (!DropboxClient.isConfigValid(config)) {
            return false;
        }
        try {
            console.debug(`${LOG_PREFIX} checking Dropbox connectivity`);
            await this.getUserInfo();
            console.debug(`${LOG_PREFIX} Dropbox connectivity verified`);
            return true;
        } catch (error) {
            // AICODE-TRAP: TRAP/DROPBOX-CONNECTION network or token errors are treated as disconnected [2025-02-14]
            console.error(`${LOG_PREFIX} connection check failed`, error);
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
        const config = await this.ensureConfigured();

        try {
            const fileSize = typeof fileBlob.size === 'number' ? fileBlob.size : undefined;
            const accessToken = await this.getAccessToken();
            const resolvedFilename = await this.ensureUniqueFilename(filename, config.TARGET_FOLDER, accessToken);
            const path = `${config.TARGET_FOLDER}/${resolvedFilename}`;
            console.log(`${LOG_PREFIX} uploading file`, {
                filename: resolvedFilename,
                path,
                bytes: fileSize ?? 'unknown'
            });

            // Конвертируем Blob в ArrayBuffer
            const arrayBuffer = await fileBlob.arrayBuffer();

            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: path,
                        mode: 'add',
                        autorename: false
                    }).replace(/[^\x00-\x7F]/g, c =>
                        '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
                    )
                },
                body: arrayBuffer
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`${LOG_PREFIX} upload failed`, response.status, errorText);
                throw new Error(`Upload failed: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            console.log(`${LOG_PREFIX} file uploaded`, {
                path: result.path_display,
                rev: result.rev,
                size: result.size
            });
            return result.path_display;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error(`${LOG_PREFIX} upload error`, err);
            throw new Error(`Failed to upload to Dropbox: ${err.message}`);
        }
    }

    /**
     * @param {string} filename
     * @param {string} targetFolder
     * @param {string} accessToken
     * @returns {Promise<string>}
     */
    async ensureUniqueFilename(filename, targetFolder, accessToken) {
        const basePath = `${targetFolder}/${filename}`;
        const exists = await this.fileExists(basePath, accessToken);
        if (!exists) {
            return filename;
        }

        for (let i = 1; i <= 5; i++) {
            const candidate = `${i}-${filename}`;
            const candidatePath = `${targetFolder}/${candidate}`;
            const candidateExists = await this.fileExists(candidatePath, accessToken);
            if (!candidateExists) {
                return candidate;
            }
        }

        const fallback = `${Date.now()}-${filename}`;
        console.warn(`${LOG_PREFIX} name collision persists after 5 attempts, using timestamp fallback`, {
            filename,
            fallback
        });
        return fallback;
    }

    /**
     * @param {string} path
     * @param {string} accessToken
     * @returns {Promise<boolean>}
     */
    async fileExists(path, accessToken) {
        const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path })
        });

        if (response.ok) {
            return true;
        }

        const errorText = await response.text().catch(() => '');
        if (response.status === 409 && errorText.includes('path/not_found')) {
            return false;
        }

        console.error(`${LOG_PREFIX} metadata check failed`, response.status, errorText);
        throw new Error(`Failed to check Dropbox path: ${response.status}`);
    }

    /**
     * Получает информацию о текущем пользователе (для отображения в UI)
     * @returns {Promise<Object>}
     */
    async getUserInfo() {
        await this.ensureConfigured();

        try {
            console.debug(`${LOG_PREFIX} requesting user info`);
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
            console.error(`${LOG_PREFIX} failed to get user info`, error);
            throw error;
        }
    }

    /**
     * @returns {Promise<{APP_KEY: string, APP_SECRET: string, REFRESH_TOKEN: string, TARGET_FOLDER: string}>}
     */
    async getConfig() {
        if (!this.configPromise) {
            this.configPromise = loadDropboxConfig().catch(error => {
                this.configPromise = null;
                console.error(`${LOG_PREFIX} failed to load Dropbox config`, error);
                throw error;
            });
        }
        const config = await this.configPromise;
        this.cachedConfig = config;
        return config;
    }

    /**
     * @returns {Promise<{APP_KEY: string, APP_SECRET: string, REFRESH_TOKEN: string, TARGET_FOLDER: string}>}
     */
    async ensureConfigured() {
        const config = await this.getConfig();
        if (!DropboxClient.isConfigValid(config)) {
            console.warn(`${LOG_PREFIX} configuration missing or placeholder values detected`);
            throw new Error('Dropbox не настроен. Проверьте .env файл и перезапустите расширение');
        }
        return config;
    }

    /**
     * @param {{APP_KEY?: string, APP_SECRET?: string, REFRESH_TOKEN?: string}} config
     */
    static isConfigValid(config) {
        return Boolean(
            config &&
            typeof config.APP_KEY === 'string' &&
            config.APP_KEY.trim() !== '' &&
            typeof config.APP_SECRET === 'string' &&
            config.APP_SECRET.trim() !== '' &&
            typeof config.REFRESH_TOKEN === 'string' &&
            config.REFRESH_TOKEN.trim() !== '' &&
            config.APP_KEY.trim() !== 'your_dropbox_app_key_here'
        );
    }
}

// Создаем глобальный экземпляр
if (typeof window !== 'undefined') {
    (/** @type {any} */(window)).dropboxClient = new DropboxClient();
}

export default DropboxClient;
