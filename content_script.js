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
        // Получаем выделенный текст
        const selection = window.getSelection();
        
        if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
            throw new Error('Пожалуйста, выделите текст на странице для экспорта');
        }

        // Извлекаем заголовок
        let title = extractTitle();
        
        // Извлекаем выделенный контент
        const content = await extractSelectedContent(selection);
        
        // Извлекаем изображения из выделенного содержимого
        const images = await extractImagesFromSelection(selection);
        
        if (!content.trim()) {
            throw new Error('Выделенный контент пуст');
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
 * Извлекает выделенное содержимое.
 * @param {Selection} selection
 * @returns {Promise<string>}
 */
async function extractSelectedContent(selection) {
    try {
        // Создаем временный контейнер для работы с выделенным содержимым
        const tempDiv = document.createElement('div');
        
        // Копируем все выделенные range в временный контейнер
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const contents = range.cloneContents();
            tempDiv.appendChild(contents);
        }
        
        // Обрабатываем содержимое так же, как и контейнерное содержимое
        return await extractTextContentFromElement(tempDiv);
    } catch (error) {
        // Если не удается извлечь HTML структуру, используем простой текст
        const selectedText = selection.toString().trim();
        if (selectedText) {
            // Разбиваем на абзацы по двойным переносам строк
            const paragraphs = selectedText.split(/\n\s*\n/).filter(p => p.trim());
            if (paragraphs.length > 1) {
                return paragraphs.map(p => `<p>${cleanText(p.trim())}</p>`).join('\n');
            } else {
                // Если это один блок текста, просто оборачиваем в параграф
                return `<p>${cleanText(selectedText)}</p>`;
            }
        }
        return '';
    }
}

/**
 * Извлекает изображения из выделенного содержимого.
 * @param {Selection} selection
 * @returns {Promise<ExtractedImage[]>}
 */
async function extractImagesFromSelection(selection) {
    const images = [];
    
    try {
        // Создаем временный контейнер для поиска изображений
        const tempDiv = document.createElement('div');
        
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const contents = range.cloneContents();
            tempDiv.appendChild(contents);
        }
        
        // Используем существующую функцию для извлечения изображений
        return await extractImages(tempDiv);
    } catch (error) {
        console.warn('Ошибка извлечения изображений из выделения:', error);
        return [];
    }
}

/**
 * Извлекает текстовое содержимое из элемента.
 * @param {Element} container
 * @returns {Promise<string>}
 */
async function extractTextContentFromElement(container) {
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
    
    // Извлекаем контент с сохранением структуры
    let formattedContent = '';
    const processedElements = new Set(); // Отслеживаем обработанные элементы
    
    // Обрабатываем элементы в порядке появления в документе
    // AICODE-WHY: Including images preserves visual context in exported EPUB [2025-08-14]
    const walker = document.createTreeWalker(
        clone,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: function(node) {
                const tagName = node.tagName.toLowerCase();
                if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'code', 'div', 'img', 'span'].includes(tagName)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        if (processedElements.has(node) || isChildOfProcessedElement(node, processedElements)) {
            continue;
        }

        const content = processElement(node);
        if (content.trim()) {
            formattedContent += content + '\n';
            processedElements.add(node);
        }
    }

    // Если структурированный контент найден, возвращаем его
    if (formattedContent.trim()) {
        return formattedContent;
    }
    
    // Если структурированный контент не найден, извлекаем весь текст
    const allText = cleanText(clone.textContent);
    if (allText) {
        // Разбиваем на абзацы по двойным переносам строк
        const paragraphs = allText.split(/\n\s*\n/).filter(p => p.trim());
        return paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
    }
    
    return '';
}

/**
 * Проверяет, является ли элемент потомком уже обработанного элемента
 * @param {Element} element
 * @param {Set<Element>} processedElements
 * @returns {boolean}
 */
function isChildOfProcessedElement(element, processedElements) {
    let parent = element.parentElement;
    while (parent) {
        if (processedElements.has(parent)) {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

/**
 * Обрабатывает отдельный элемент и возвращает его HTML представление
 * @param {Element} element
 * @returns {string}
 */
function processElement(element) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            const headerText = cleanText(element.textContent);
            return headerText ? `<${tagName}>${headerText}</${tagName}>` : '';
            
        case 'p':
            const pText = cleanText(element.textContent);
            return pText ? `<p>${pText}</p>` : '';
            
        case 'blockquote':
            const quoteText = cleanText(element.textContent);
            return quoteText ? `<blockquote>${quoteText}</blockquote>` : '';
            
        case 'pre':
            // Проверяем, есть ли внутри code элемент с data-highlighted
            const codeElement = element.querySelector('code[data-highlighted="yes"]');
            if (codeElement) {
                // Сохраняем оригинальное форматирование для подсвеченного кода
                const codeContent = codeElement.innerHTML;
                return `<pre><code>${codeContent}</code></pre>`;
            } else {
                const preText = cleanText(element.textContent);
                return preText ? `<pre><code>${preText}</code></pre>` : '';
            }
            
        case 'code':
            // Обрабатываем отдельные элементы code с подсветкой синтаксиса
            if (element.getAttribute('data-highlighted') === 'yes') {
                const codeContent = element.innerHTML;
                return `<code>${codeContent}</code>`;
            } else {
                const codeText = cleanText(element.textContent);
                return codeText ? `<code>${codeText}</code>` : '';
            }

        case 'ul':
        case 'ol':
            return processList(element, tagName);

        case 'img': {
            const src = element.getAttribute('src') || element.getAttribute('data-src');
            if (!src) return '';
            const alt = cleanText(element.getAttribute('alt') || '');
            const width = element.getAttribute('width') || element.width;
            const height = element.getAttribute('height') || element.height;
            // AICODE-TRAP: Preserve original src so EPUB generator can map to downloaded file [2025-08-14]
            return `<img src="${src}" alt="${alt}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}/>`;
        }

        case 'span': {
            // AICODE-WHY: Bubble HTML wraps paragraphs in span nodes; treat them as block-level text [2025-10-20]
            const spanText = cleanText(element.textContent);
            return spanText ? `<p>${spanText}</p>` : '';
        }

        case 'div':
            // Обрабатываем div только если он содержит прямой текстовый контент
            const directText = getDirectTextContent(element);
            if (directText && directText.trim()) {
                return `<p>${cleanText(directText)}</p>`;
            }
            return '';
            
        default:
            return '';
    }
}

/**
 * Обрабатывает списки (ul/ol) с сохранением структуры
 * @param {Element} listElement
 * @param {string} tagName
 * @returns {string}
 */
function processList(listElement, tagName) {
    const listItems = listElement.querySelectorAll(':scope > li');
    if (listItems.length === 0) {
        return '';
    }
    
    let listContent = '';
    listItems.forEach(li => {
        const liText = cleanText(li.textContent);
        if (liText) {
            listContent += `    <li>${liText}</li>\n`;
        }
    });
    
    if (listContent) {
        return `<${tagName}>\n${listContent}</${tagName}>`;
    }
    
    return '';
}

/**
 * Получает прямой текстовый контент элемента (без вложенных элементов)
 * @param {Element} element
 * @returns {string}
 */
function getDirectTextContent(element) {
    let text = '';
    for (let node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        }
    }
    return text;
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
            // AICODE-TRAP: jsdom clones report zero width/height; prefer natural dimensions or attributes to avoid dropping real images [2025-08-14]
            const attrWidth = parseInt(img.getAttribute('width') || '', 10);
            const attrHeight = parseInt(img.getAttribute('height') || '', 10);
            const effectiveWidth = img.naturalWidth || (!Number.isNaN(attrWidth) ? attrWidth : img.width);
            const effectiveHeight = img.naturalHeight || (!Number.isNaN(attrHeight) ? attrHeight : img.height);

            // Пропускаем иконки только если известные размеры слишком малы
            if (effectiveWidth && effectiveHeight && (effectiveWidth < 50 || effectiveHeight < 50)) {
                continue;
            }

            const rawSrc = img.getAttribute('src') || img.getAttribute('data-src');
            const src = img.src || rawSrc;
            if (!src || !rawSrc) continue;

            // Конвертируем в base64
            const base64 = await imageToBase64(src);
            if (base64) {
                images.push({
                    src: src,
                    originalSrc: rawSrc,
                    base64: base64,
                    alt: img.alt || '',
                    width: effectiveWidth || 'auto',
                    height: effectiveHeight || 'auto'
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
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
        console.log('Найдено выделение:', selection.toString().substring(0, 500) + '...');
        console.log('Количество диапазонов:', selection.rangeCount);
    } else {
        console.log('Нет выделенного текста');
        console.log('Пожалуйста, выделите текст на странице');
    }
}

// Экспорт функций для тестирования
if (typeof window !== 'undefined') {
    window.extractPageContent = extractPageContent;
    window.extractSelectedContent = extractSelectedContent;
    window.extractTitle = extractTitle;
    window.cleanText = cleanText;
    window.extractImagesFromSelection = extractImagesFromSelection;
    window.extractImages = extractImages;
    window.processList = processList;
    window.getDirectTextContent = getDirectTextContent;
    window.isChildOfProcessedElement = isChildOfProcessedElement;
    window.processElement = processElement;
    window.debugExtraction = debugExtraction;
}
