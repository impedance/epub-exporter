// @ts-check
/* global chrome */
// Content script для извлечения контента страницы
/* AICODE-WHY: JSDoc types formalize the content contract for cross-module reuse [2025-08-13] */
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent

/** @typedef {import('./types').ExtractedImage} ExtractedImage */
/** @typedef {import('./types').ExtractedContent} ExtractedContent */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
        extractPageContent()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Асинхронный ответ
    }
});

/**
 * Извлекает контент страницы.
 * @returns {Promise<ExtractedContent>}
 */
async function extractPageContent() {
    try {
        // Ищем основной контейнер с контентом
        const container = document.querySelector('.step-dynamic-container');
        
        if (!container) {
            throw new Error('Контейнер .step-dynamic-container не найден на странице');
        }

        // Извлекаем заголовок
        let title = extractTitle();
        
        // Извлекаем текстовый контент
        const content = await extractTextContent(container);
        
        // Извлекаем изображения
        const images = await extractImages(container);
        
        if (!content.trim()) {
            throw new Error('Контент не найден или пуст');
        }

        return {
            title,
            content,
            images,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        const err = /** @type {Error} */ (error);
        console.error('Ошибка извлечения контента:', err);
        throw err;
    }
}

/**
 * Определяет заголовок страницы.
 * @returns {string}
 */
function extractTitle() {
    // Пытаемся найти заголовок в разных местах
    const titleSelectors = [
        'h1',
        '.step-dynamic-container h1',
        '.step-dynamic-container h2',
        '.title',
        '.page-title',
        'title'
    ];
    
    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            return cleanText(element.textContent);
        }
    }
    
    // Если заголовок не найден, используем title страницы
    return document.title || 'Экспортированная статья';
}

/**
 * Извлекает текстовое содержимое из контейнера.
 * @param {Element} container
 * @returns {Promise<string>}
 */
async function extractTextContent(container) {
    // Клонируем контейнер для безопасной обработки
    const clone = /** @type {HTMLElement} */ (container.cloneNode(true));
    
    // Удаляем нежелательные элементы
    const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer',
        '.nav', '.navigation', '.menu', '.sidebar',
        '.ads', '.advertisement', '.social-share',
        '.comments', '.related-posts', '.popup',
        '[class*="ad-"]', '[id*="ad-"]'
    ];
    
    unwantedSelectors.forEach(selector => {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });
    
    // Извлекаем и форматируем текст
    const textElements = clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, code');
    let formattedContent = '';
    
    textElements.forEach(element => {
        const text = cleanText(element.textContent);
        if (text) {
            const tagName = element.tagName.toLowerCase();
            
            switch (tagName) {
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    formattedContent += `\n<${tagName}>${text}</${tagName}>\n`;
                    break;
                case 'blockquote':
                    formattedContent += `\n<blockquote>${text}</blockquote>\n`;
                    break;
                case 'pre':
                case 'code':
                    formattedContent += `\n<pre><code>${text}</code></pre>\n`;
                    break;
                case 'li':
                    formattedContent += `<li>${text}</li>\n`;
                    break;
                default:
                    formattedContent += `<p>${text}</p>\n`;
            }
        }
    });
    
    // Если структурированный контент не найден, извлекаем весь текст
    if (!formattedContent.trim()) {
        const allText = cleanText(clone.textContent);
        if (allText) {
            // Разбиваем на абзацы по двойным переносам строк
            const paragraphs = allText.split(/\n\s*\n/).filter(p => p.trim());
            formattedContent = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
        }
    }
    
    return formattedContent;
}

/**
 * Собирает изображения из контейнера.
 * @param {Element} container
 * @returns {Promise<ExtractedImage[]>}
 */
async function extractImages(container) {
    const images = [];
    const imgElements = container.querySelectorAll('img');
    
    for (let img of imgElements) {
        try {
            // Пропускаем очень маленькие изображения (вероятно, иконки)
            if (img.width < 50 || img.height < 50) continue;

            const src = img.src || img.getAttribute('data-src');
            if (!src) continue;

            // Конвертируем в base64
            const base64 = await imageToBase64(src);
            if (base64) {
                images.push({
                    src: src,
                    base64: base64,
                    alt: img.alt || '',
                    width: img.width || 'auto',
                    height: img.height || 'auto'
                });
            }
        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.warn('Ошибка обработки изображения:', err);
        }
    }
    
    return images;
}

/**
 * Конвертирует изображение в base64.
 * @param {string} src
 * @returns {Promise<string|null>}
 */
function imageToBase64(src) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                if (!ctx) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(img, 0, 0);

                try {
                    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(dataURL);
                } catch (error) {
                    const err = /** @type {Error} */ (error);
                    console.warn('Ошибка конвертации в base64:', err);
                    resolve(null);
                }
            };

            img.onerror = () => {
                resolve(null);
            };

            img.src = src;
        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.warn('Ошибка загрузки изображения:', err);
            resolve(null);
        }
    });
}

/**
 * Очищает текст от лишних символов.
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
        .trim();
}

// Вспомогательная функция для отладки
/**
 * Вспомогательная функция для отладки
 * @returns {void}
 */
function debugExtraction() {
    const container = document.querySelector('.step-dynamic-container');
    if (container) {
        console.log('Найден контейнер:', container);
        console.log('Содержимое:', container.innerHTML.substring(0, 500) + '...');
    } else {
        console.log('Контейнер .step-dynamic-container не найден');
        console.log('Доступные классы:', Array.from(document.querySelectorAll('[class]')).map(el => el.className));
    }
}