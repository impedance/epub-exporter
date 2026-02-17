// @ts-check

import { MAX_IMAGE_SIZE_FOR_OPTIMIZATION, MAX_IMAGE_WIDTH, JPEG_QUALITY } from '../config.js';

/** @typedef {import('../types').ExtractedImage} ExtractedImage */

// AICODE-TRAP: TRAP/FETCH-CDN CDN responses may block Fetch API despite host permissions; fall back to XHR in MV3 background [2025-10-22]
/**
 * Загружает изображение и возвращает data URL строку.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchImageAsDataURL(url) {
  const fetchResult = await tryFetchImageViaFetch(url);
  if (fetchResult) {
    return fetchResult;
  }
  return await fetchImageViaXHR(url);
}

// AICODE-NOTE: DECISION/IMAGE-NORMALIZE decision: parse HTML + normalize missing image blobs so EPUB packs remote assets when selection metadata is incomplete.
/**
 * Ensures every image has an embeddable data URL, fetching in the background if needed.
 * @param {ExtractedImage[]} [images=[]]
 * @param {string} [pageUrl]
 * @param {string} [htmlContent]
 * @returns {Promise<ExtractedImage[]>}
 */
export async function prepareImages(images = [], pageUrl = '', htmlContent = '') {
  if (!Array.isArray(images) || images.length === 0) {
    images = [];
  }

  /** @type {ExtractedImage[]} */
  const prepared = [];
  const seen = new Set();

  /** @type {Array<any>} */
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

    let base64Data = candidate.base64 && candidate.base64.startsWith('data:') ? candidate.base64 : null;

    if (!base64Data) {
      const fetchCandidates = new Set();
      if (candidate.resolvedSrc) {
        fetchCandidates.add(candidate.resolvedSrc);
      }
      if (candidate.originalSrc) {
        fetchCandidates.add(candidate.originalSrc);
      }

      const tried = new Set();
      for (const srcCandidate of fetchCandidates) {
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

    try {
      base64Data = await optimizeImage(base64Data);
    } catch (error) {
      console.warn('Ошибка оптимизации изображения:', error);
    }

    const normalizedSrc =
      normalizeImageUrl(candidate.resolvedSrc || candidate.originalSrc, pageUrl) ||
      candidate.resolvedSrc ||
      candidate.originalSrc;

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
 * Extracts <img> candidates from raw HTML content.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {ExtractedImage[]}
 */
export function extractImageCandidatesFromHtml(html, pageUrl) {
  if (typeof html !== 'string' || html.trim() === '') {
    return [];
  }

  /** @type {ExtractedImage[]} */
  const candidates = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img');
      images.forEach((img) => {
        const srcAttr = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (!srcAttr) {
          return;
        }
        const resolved = normalizeImageUrl(srcAttr, pageUrl) || srcAttr;
        candidates.push({
          originalSrc: srcAttr,
          src: resolved,
          base64: '',
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
    const srcAttr = srcMatch[1];
    if (!srcAttr) {
      continue;
    }
    const resolved = normalizeImageUrl(srcAttr, pageUrl) || srcAttr;
    const altMatch = tag.match(/\salt=["']([^"']*)["']/i);
    const widthMatch = tag.match(/\swidth=["']([^"']*)["']/i);
    const heightMatch = tag.match(/\sheight=["']([^"']*)["']/i);
    candidates.push({
      src: resolved,
      originalSrc: srcAttr,
      base64: '',
      alt: altMatch?.[1] ?? '',
      width: widthMatch?.[1] ?? 'auto',
      height: heightMatch?.[1] ?? 'auto'
    });
  }

  return candidates;
}

/**
 * Оптимизирует изображение: сжимает, меняет размер и конвертирует анимации в статику.
 * @param {string} dataUrl
 * @returns {Promise<string>}
 */
export async function optimizeImage(dataUrl) {
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  const isGif = dataUrl.includes('image/gif');
  const approxSize = Math.round((dataUrl.length * 3) / 4);
  const isLarge = approxSize > MAX_IMAGE_SIZE_FOR_OPTIMIZATION;

  if (!isGif && !isLarge) {
    return dataUrl;
  }

  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    console.warn('OffscreenCanvas не поддерживается, пропускаем оптимизацию');
    return dataUrl;
  }

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const imageBitmap = await createImageBitmap(blob);

    let { width, height } = imageBitmap;
    if (width > MAX_IMAGE_WIDTH) {
      const ratio = MAX_IMAGE_WIDTH / width;
      width = MAX_IMAGE_WIDTH;
      height = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) {
      return dataUrl;
    }
    context.drawImage(imageBitmap, 0, 0, width, height);

    const optimizedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: Number(JPEG_QUALITY || 0.8)
    });

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(/** @type {string} */ (reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(optimizedBlob);
    });
  } catch (error) {
    console.error('Ошибка в optimizeImage:', error);
    return dataUrl;
  }
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
  return (resolvedSrc || originalSrc || '').trim().toLowerCase();
}

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
    const chunkLength = chunk.length;
    for (let index = 0; index < chunkLength; index++) {
      const byte = chunk[index];
      if (byte !== undefined) {
        chunkString += String.fromCharCode(byte);
      }
    }
    binary += chunkString;
  }

  return btoa(binary);
}
