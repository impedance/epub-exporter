// @ts-check
/* global chrome */

(() => {

/**
 * @returns {{ cleanText: (text: string) => string }}
 */
function getCleanupApi() {
  const cleanup = /** @type {any} */ (globalThis).EpubContentCleanup;
  if (!cleanup || typeof cleanup.cleanText !== 'function') {
    throw new Error('EpubContentCleanup не инициализирован');
  }
  return cleanup;
}

/**
 * @returns {{ cloneSelectionToContainer: (selection: Selection) => HTMLDivElement }}
 */
function getSelectionApi() {
  const selection = /** @type {any} */ (globalThis).EpubContentSelection;
  if (!selection || typeof selection.cloneSelectionToContainer !== 'function') {
    throw new Error('EpubContentSelection не инициализирован');
  }
  return selection;
}

/**
 * Извлекает изображения из выделенного содержимого.
 * @param {Selection} selection
 * @returns {Promise<import('../types').ExtractedImage[]>}
 */
async function extractImagesFromSelection(selection) {
  try {
    const { cloneSelectionToContainer } = getSelectionApi();
    const tempDiv = cloneSelectionToContainer(selection);
    return await extractImages(tempDiv);
  } catch (error) {
    console.warn('Ошибка извлечения изображений из выделения:', error);
    return [];
  }
}

/**
 * Собирает изображения из контейнера.
 * @param {Element} container
 * @returns {Promise<import('../types').ExtractedImage[]>}
 */
async function extractImages(container) {
  const images = [];
  const imgElements = container.querySelectorAll('img');

  for (const img of imgElements) {
    try {
      // AICODE-TRAP: TRAP/JSDOM-IMG-DIMS jsdom clones report zero width/height; prefer natural dimensions or attributes to avoid dropping real images [2025-08-14]
      const attrWidth = parseInt(img.getAttribute('width') || '', 10);
      const attrHeight = parseInt(img.getAttribute('height') || '', 10);
      const effectiveWidth = img.naturalWidth || (!Number.isNaN(attrWidth) ? attrWidth : img.width);
      const effectiveHeight = img.naturalHeight || (!Number.isNaN(attrHeight) ? attrHeight : img.height);

      if (effectiveWidth && effectiveHeight && (effectiveWidth < 50 || effectiveHeight < 50)) {
        continue;
      }

      const rawSrc = img.getAttribute('src') || img.getAttribute('data-src');
      const src = img.src || rawSrc;
      if (!src || !rawSrc) {
        continue;
      }

      const base64 = await imageToBase64(rawSrc, src);
      if (base64) {
        images.push({
          src,
          originalSrc: rawSrc,
          base64,
          alt: img.alt || '',
          width: effectiveWidth || 'auto',
          height: effectiveHeight || 'auto'
        });
      }
    } catch (error) {
      const imageError = /** @type {Error} */ (error);
      console.warn('Ошибка обработки изображения:', imageError);
    }
  }

  return images;
}

// AICODE-TRAP: TRAP/CORS-CANVAS CDN images without CORS taint canvas; use fetch fallback first [2025-10-21]
/**
 * Конвертирует изображение в base64 с учетом CORS ограничений.
 * @param {string} rawSrc
 * @param {string} resolvedSrc
 * @returns {Promise<string|null>}
 */
async function imageToBase64(rawSrc, resolvedSrc) {
  if (!rawSrc && !resolvedSrc) {
    return null;
  }

  if ((rawSrc && rawSrc.startsWith('data:')) || (resolvedSrc && resolvedSrc.startsWith('data:'))) {
    return resolvedSrc || rawSrc;
  }

  const candidates = new Set();
  if (resolvedSrc) {
    candidates.add(resolvedSrc);
  }

  if (rawSrc && rawSrc !== resolvedSrc) {
    try {
      candidates.add(new URL(rawSrc, window.location.href).href);
    } catch (error) {
      // ignore invalid URL
    }
  }

  for (const candidate of candidates) {
    const dataUrl = await fetchImageWithFallback(candidate);
    if (dataUrl) {
      return dataUrl;
    }
  }

  return await convertImageWithCanvas(resolvedSrc || rawSrc);
}

/**
 * Пытается загрузить изображение напрямую, затем через background fallback.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchImageWithFallback(url) {
  if (!url) {
    return null;
  }

  const directResult = await fetchImageDirect(url);
  if (directResult) {
    return directResult;
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetchImageAsDataURL',
        url
      });
      if (response?.success && response.dataUrl) {
        return response.dataUrl;
      }
    } catch (error) {
      const fetchError = /** @type {Error} */ (error);
      console.warn('Background fetch failed:', fetchError.message);
    }
  }

  return null;
}

/**
 * Получает изображение через fetch внутри content script.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchImageDirect(url) {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache'
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      return null;
    }

    const dataUrl = await blobToDataURL(blob);
    return dataUrl || null;
  } catch (error) {
    return null;
  }
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {string} url
 * @returns {Promise<string|null>}
 */
function convertImageWithCanvas(url) {
  if (!url) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';

      image.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0);

        try {
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (error) {
          console.warn('Ошибка конвертации в base64:', error);
          resolve(null);
        }
      };

      image.onerror = () => {
        resolve(null);
      };

      image.src = url;
    } catch (error) {
      resolve(null);
    }
  });
}

if (typeof globalThis !== 'undefined') {
  const { cleanText } = getCleanupApi();
  /** @type {any} */ (globalThis).EpubContentImages = {
    extractImagesFromSelection,
    extractImages,
    imageToBase64,
    cleanText
  };
}
})();
