// @ts-check
/* global chrome */
// Background script для обработки создания EPUB файлов
import EPUBGenerator from './epub_generator.js';

/** @typedef {import('./types').ExtractedImage} ExtractedImage */
/** @typedef {import('./types').ExtractedContent} ExtractedContent */
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent
// AICODE-LINK: ./epub_generator.js#createEPUB

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'createEPUB') {
        createEPUBFile(request.data)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Асинхронный ответ
    }
});

/**
 * Создает EPUB файл из переданных данных.
 * @param {ExtractedContent} data
 * @returns {Promise<{downloadUrl: string, filename: string}>}
 */
async function createEPUBFile(data) {
    try {
        const generator = new EPUBGenerator();
        const { title, content, images, url } = data;
        const result = await generator.createEPUB(title, content, images, url);
        return { downloadUrl: result.downloadUrl, filename: result.filename };
    } catch (error) {
        const err = /** @type {Error} */ (error);
        console.error('Ошибка создания EPUB:', err);
        throw err;
    }
}
