// @ts-check
/* global chrome */
// Background script для обработки создания EPUB файлов
import EPUBGenerator from './epub_generator.js';
import './config.js';
import DropboxClient from './dropbox_client.js';

/** @typedef {import('./types').ExtractedImage} ExtractedImage */
/** @typedef {import('./types').ExtractedContent} ExtractedContent */
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent
// AICODE-LINK: ./epub_generator.js#createEPUB

const dropboxClient = new DropboxClient();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'createEPUB') {
        createEPUBFile(request.data, { uploadToDropbox: Boolean(request.uploadToDropbox) })
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Асинхронный ответ
    }
});

/**
 * Создает EPUB файл из переданных данных.
 * @param {ExtractedContent} data
 * @param {{ uploadToDropbox?: boolean }} [options]
 * @returns {Promise<{downloadUrl: string, filename: string, dropboxPath?: string}>}
 */
async function createEPUBFile(data, options = {}) {
    try {
        const generator = new EPUBGenerator();
        const { title, content, images, url } = data;
        const result = await generator.createEPUB(title, content, images, url);

        let dropboxPath;
        if (options.uploadToDropbox) {
            // AICODE-WHY: Service worker uploads immediately so users get Dropbox copy without extra steps [2025-10-20]
            dropboxPath = await dropboxClient.uploadFile(result.blob, result.filename);
        }

        return {
            downloadUrl: result.downloadUrl,
            filename: result.filename,
            dropboxPath
        };
    } catch (error) {
        const err = /** @type {Error} */ (error);
        console.error('Ошибка создания EPUB:', err);
        throw err;
    }
}
