// @ts-check
/* global chrome */
/**
 * AICODE-NOTE: NAV/GMAIL-CLIENT implementation of Gmail API for Kindle export.
 * Follows patterns from dropbox_client.js for consistency.
 */

import { loadGmailConfig } from './config.js';

const LOG_PREFIX = '[gmail]';

class GmailClient {
    constructor() {
        this.accessToken = null;
        this.configPromise = null;
        console.debug(`${LOG_PREFIX} client initialized`);
    }

    /**
     * Проверяет, авторизован ли пользователь в Gmail
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        try {
            const token = await this.getAccessToken(false); // interactive: false
            return !!token;
        } catch (error) {
            console.debug(`${LOG_PREFIX} connection check failed (expected if not authorized)`, error);
            return false;
        }
    }

    /**
     * Получает OAuth токен через chrome.identity
     * @param {boolean} interactive - Показывать ли окно выбора аккаунта если нет токена
     * @returns {Promise<string>}
     */
    async getAccessToken(interactive = true) {
        if (typeof chrome === 'undefined' || !chrome.identity) {
            throw new Error('Gmail API требует Chrome Extension environment с identity permission');
        }

        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    console.warn(`${LOG_PREFIX} auth failed:`, chrome.runtime.lastError.message);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                this.accessToken = token;
                resolve(token);
            });
        });
    }

    /**
     * Отправляет EPUB файл на Kindle адрес
     * @param {Blob} fileBlob - EPUB файл
     * @param {string} filename - Имя файла
     * @param {string} kindleEmail - Email адрес Kindle
     * @returns {Promise<Object>} - Ответ от Gmail API
     */
    async sendEmail(fileBlob, filename, kindleEmail) {
        const token = await this.getAccessToken(true);
        const config = await this.getConfig();
        const targetEmail = kindleEmail || config.KINDLE_EMAIL;

        if (!targetEmail) {
            throw new Error('Email адрес Kindle не указан');
        }

        console.log(`${LOG_PREFIX} sending ${filename} to ${targetEmail}`);

        const boundary = 'foo_bar_baz';
        const fileData = await this.blobToBase64(fileBlob);

        // Формируем MIME сообщение
        const messageParts = [
            `To: ${targetEmail}`,
            'Subject: Convert', // Kindle часто требует Subject или ничего
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset="UTF-8"',
            'Content-Transfer-Encoding: 7bit',
            '',
            'Attached is your EPUB book exported via EPUB Exporter extension.',
            '',
            `--${boundary}`,
            `Content-Type: application/epub+zip; name="${filename}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${filename}"`,
            '',
            fileData,
            '',
            `--${boundary}--`
        ];

        const rawMessage = messageParts.join('\r\n');

        // Gmail API требует base64url кодирования всего сообщения
        const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: encodedMessage
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`${LOG_PREFIX} send failed`, error);
            throw new Error(`Gmail API error: ${error.error?.message || response.statusText}`);
        }

        const result = await response.json();
        console.log(`${LOG_PREFIX} email sent successfully`, result.id);
        return result;
    }

    /**
     * Вспомогательная функция для конвертации Blob в Base64
     * @param {Blob} blob 
     * @returns {Promise<string>}
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result !== 'string') return reject(new Error('Failed to read blob'));
                // Удаляем data:application/epub+zip;base64,
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * @returns {Promise<{CLIENT_ID: string, KINDLE_EMAIL: string}>}
     */
    async getConfig() {
        if (!this.configPromise) {
            this.configPromise = loadGmailConfig();
        }
        return await this.configPromise;
    }
}

// Создаем глобальный экземпляр для доступа из popup
if (typeof window !== 'undefined') {
    // @ts-ignore
    window.gmailClient = new GmailClient();
}

export default GmailClient;
