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

    if (request.action === 'fetchImageAsDataURL' && request.url) {
        fetchImageAsDataURL(request.url)
            .then(dataUrl => sendResponse({ success: true, dataUrl }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
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
        const preparedImages = await prepareImages(images, url);
        const result = await generator.createEPUB(title, content, preparedImages, url);

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

// AICODE-WHY: Background fetch bypasses strict canvas CORS so EPUB always embeds remote images [2025-10-21]
/**
 * Загружает изображение и возвращает data URL строку.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchImageAsDataURL(url) {
    const fetchResult = await tryFetchImageViaFetch(url);
    if (fetchResult) {
        return fetchResult;
    }
    return await fetchImageViaXHR(url);
}

// AICODE-WHY: Background normalizes missing image blobs so EPUB packs remote assets even when content script hits CORS walls [2025-10-22]
/**
 * Ensures every image has an embeddable data URL, fetching in the background if needed.
 * @param {ExtractedImage[]} [images=[]]
 * @param {string} [pageUrl]
 * @returns {Promise<ExtractedImage[]>}
 */
async function prepareImages(images = [], pageUrl = '') {
    if (!Array.isArray(images) || images.length === 0) {
        return [];
    }

    const prepared = [];
    for (const image of images) {
        if (!image) {
            continue;
        }

        if (typeof image.base64 === 'string' && image.base64.startsWith('data:')) {
            prepared.push(image);
            continue;
        }

        const candidates = new Set();
        if (image.src) {
            candidates.add(image.src);
        }
        if (image.originalSrc) {
            candidates.add(image.originalSrc);
        }

        let base64Data = null;
        const tried = new Set();
        for (const candidate of candidates) {
            const normalized = normalizeImageUrl(candidate, pageUrl);
            if (!normalized) {
                continue;
            }
            if (tried.has(normalized)) {
                continue;
            }
            tried.add(normalized);
            if (normalized.startsWith('data:')) {
                base64Data = normalized;
                break;
            }
            try {
                base64Data = await fetchImageAsDataURL(normalized);
                if (base64Data) {
                    break;
                }
            } catch (error) {
                console.warn('Не удалось загрузить изображение в фоне:', normalized, error);
            }
        }

        if (base64Data) {
            prepared.push({ ...image, base64: base64Data });
        } else {
            console.warn('Пропускаем изображение без данных:', image.originalSrc || image.src);
        }
    }

    return prepared;
}

/**
 * Resolves an arbitrary image reference to an absolute URL.
 * @param {string} candidate
 * @param {string} pageUrl
 * @returns {string|null}
 */
function normalizeImageUrl(candidate, pageUrl) {
    if (!candidate) {
        return null;
    }
    if (candidate.startsWith('data:')) {
        return candidate;
    }
    if (/^https?:\/\//i.test(candidate)) {
        return candidate;
    }
    if (candidate.startsWith('//')) {
        try {
            const protocol = pageUrl ? new URL(pageUrl).protocol : 'https:';
            return `${protocol}${candidate}`;
        } catch (error) {
            return `https:${candidate}`;
        }
    }
    if (pageUrl) {
        try {
            return new URL(candidate, pageUrl).href;
        } catch (error) {
            return null;
        }
    }
    return null;
}

// AICODE-TRAP: CDN responses may block Fetch API despite host permissions; fall back to XHR which still works in MV3 background [2025-10-22]
/**
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function tryFetchImageViaFetch(url) {
    try {
        const response = await fetch(url, { credentials: 'omit', redirect: 'follow' });
        if (!response.ok) {
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
            return null;
        }

        const buffer = await response.arrayBuffer();
        return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
    } catch (error) {
        console.warn('Fetch API не смог загрузить изображение, пробуем XHR:', url, error);
        return null;
    }
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchImageViaXHR(url) {
    return new Promise((resolve, reject) => {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
                if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) {
                    reject(new Error(`XHR статус ${xhr.status}`));
                    return;
                }
                const contentType = xhr.getResponseHeader('content-type') || 'image/jpeg';
                if (!contentType.startsWith('image/')) {
                    reject(new Error(`XHR получил неподдерживаемый тип ${contentType}`));
                    return;
                }
                const buffer = xhr.response;
                if (!(buffer instanceof ArrayBuffer)) {
                    reject(new Error('XHR не вернул ArrayBuffer'));
                    return;
                }
                resolve(`data:${contentType};base64,${arrayBufferToBase64(buffer)}`);
            };
            xhr.onerror = () => reject(new Error('XHR ошибка сети'));
            xhr.ontimeout = () => reject(new Error('XHR таймаут'));
            xhr.send();
        } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

/**
 * Конвертирует ArrayBuffer в base64.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        let chunkString = '';
        for (let j = 0; j < chunk.length; j++) {
            chunkString += String.fromCharCode(chunk[j]);
        }
        binary += chunkString;
    }

    return btoa(binary);
}
