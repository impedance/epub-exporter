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
        const preparedImages = await prepareImages(images, url, content);
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

// AICODE-WHY: HTML fallback parsing fetches remote <img> assets even when selection metadata misses them [2025-10-22]
// AICODE-WHY: Background normalizes missing image blobs so EPUB packs remote assets even when content script hits CORS walls [2025-10-22]
/**
 * Ensures every image has an embeddable data URL, fetching in the background if needed.
 * @param {ExtractedImage[]} [images=[]]
 * @param {string} [pageUrl]
 * @param {string} [htmlContent]
 * @returns {Promise<ExtractedImage[]>}
 */
async function prepareImages(images = [], pageUrl = '', htmlContent = '') {
    if (!Array.isArray(images) || images.length === 0) {
        images = [];
    }

    const prepared = [];
    const seen = new Set();

    const queue = [];
    for (const image of images) {
        if (!image) {
            continue;
        }
        queue.push({
            originalSrc: image.originalSrc || image.src || '',
            resolvedSrc: image.src || '',
            alt: image.alt || '',
            width: image.width ?? 'auto',
            height: image.height ?? 'auto',
            base64: typeof image.base64 === 'string' ? image.base64 : ''
        });
    }

    const htmlCandidates = extractImageCandidatesFromHtml(htmlContent, pageUrl);
    for (const candidate of htmlCandidates) {
        queue.push(candidate);
    }

    for (const candidate of queue) {
        const key = makeImageKey(candidate.originalSrc, candidate.resolvedSrc, pageUrl);
        if (!key || seen.has(key)) {
            continue;
        }

        let base64Data = candidate.base64 && candidate.base64.startsWith('data:')
            ? candidate.base64
            : null;

        if (!base64Data) {
            const candidates = new Set();
            if (candidate.resolvedSrc) {
                candidates.add(candidate.resolvedSrc);
            }
            if (candidate.originalSrc) {
                candidates.add(candidate.originalSrc);
            }

            const tried = new Set();
            for (const srcCandidate of candidates) {
                const normalized = normalizeImageUrl(srcCandidate, pageUrl);
                if (!normalized || tried.has(normalized)) {
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
        }

        if (!base64Data) {
            continue;
        }

        const normalizedSrc = normalizeImageUrl(candidate.resolvedSrc || candidate.originalSrc, pageUrl)
            || candidate.resolvedSrc
            || candidate.originalSrc;

        if (!normalizedSrc) {
            continue;
        }

        prepared.push({
            src: normalizedSrc,
            originalSrc: candidate.originalSrc || candidate.resolvedSrc || normalizedSrc,
            base64: base64Data,
            alt: candidate.alt || '',
            width: candidate.width ?? 'auto',
            height: candidate.height ?? 'auto'
        });

        seen.add(key);
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

/**
 * Creates a stable key for deduplicating image candidates.
 * @param {string} originalSrc
 * @param {string} resolvedSrc
 * @param {string} pageUrl
 * @returns {string}
 */
function makeImageKey(originalSrc, resolvedSrc, pageUrl) {
    const normalizedResolved = normalizeImageUrl(resolvedSrc, pageUrl);
    if (normalizedResolved) {
        return normalizedResolved;
    }
    const normalizedOriginal = normalizeImageUrl(originalSrc, pageUrl);
    if (normalizedOriginal) {
        return normalizedOriginal;
    }
    const fallback = resolvedSrc || originalSrc || '';
    return fallback.trim().toLowerCase();
}

/**
 * Extracts <img> candidates from raw HTML content.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Array<{originalSrc: string, resolvedSrc: string, alt: string, width: number|string, height: number|string, base64?: string}>}
 */
function extractImageCandidatesFromHtml(html, pageUrl) {
    if (typeof html !== 'string' || html.trim() === '') {
        return [];
    }

    const candidates = [];

    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const imgs = doc.querySelectorAll('img');
            imgs.forEach(img => {
                const srcAttr = img.getAttribute('src') || img.getAttribute('data-src') || '';
                if (!srcAttr) {
                    return;
                }
                const resolved = normalizeImageUrl(srcAttr, pageUrl) || srcAttr;
                candidates.push({
                    originalSrc: srcAttr,
                    resolvedSrc: resolved,
                    alt: img.getAttribute('alt') || '',
                    width: img.getAttribute('width') || 'auto',
                    height: img.getAttribute('height') || 'auto'
                });
            });
            if (candidates.length > 0) {
                return candidates;
            }
        } catch (error) {
            console.warn('DOMParser не смог разобрать HTML, используем резервный парсер:', error);
        }
    }

    const regex = /<img\b[^>]*>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const tag = match[0];
        const srcMatch = tag.match(/\s(?:src|data-src)=["']([^"']+)["']/i);
        if (!srcMatch) {
            continue;
        }
        const attr = srcMatch[1].trim();
        if (!attr) {
            continue;
        }
        const resolved = normalizeImageUrl(attr, pageUrl) || attr;
        const altMatch = tag.match(/\salt=["']([^"']*)["']/i);
        const widthMatch = tag.match(/\swidth=["']([^"']*)["']/i);
        const heightMatch = tag.match(/\sheight=["']([^"']*)["']/i);
        candidates.push({
            originalSrc: attr,
            resolvedSrc: resolved,
            alt: altMatch ? altMatch[1] : '',
            width: widthMatch ? widthMatch[1] : 'auto',
            height: heightMatch ? heightMatch[1] : 'auto'
        });
    }

    return candidates;
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

export { prepareImages, extractImageCandidatesFromHtml };
