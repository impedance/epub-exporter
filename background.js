// @ts-check
/* global JSZip, chrome */
// Background script для обработки создания EPUB файлов
import EPUBGenerator from './epub_generator.js';

/**
 * @typedef {Object} ExtractedImage
 * @property {string} src
 * @property {string} base64
 * @property {string} alt
 * @property {number|string} width
 * @property {number|string} height
 */

/**
 * @typedef {Object} ExtractedContent
 * @property {string} title
 * @property {string} content
 * @property {ExtractedImage[]} images
 * @property {string} url
 * @property {string} timestamp
 */

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

// AICODE-LINK: ./epub_generator.js#loadJSZip
/**
 * Загружает JSZip из локального файла расширения.
 * @returns {Promise<typeof JSZip>}
 */
async function loadJSZip() {
    try {
        // AICODE-TRAP: import() disallowed in ServiceWorkerGlobalScope; load via fetch + Function [2025-08-11]
        // AICODE-WHY: Load JSZip locally to avoid network dependency during EPUB generation [2025-08-10]
        const jszipUrl = chrome.runtime.getURL('jszip.min.js');
        const response = await fetch(jszipUrl);
        const scriptText = await response.text();
        const JSZip = new Function(`${scriptText}; return JSZip;`)();

        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip не загружен из локального файла');
        }

        // Проверяем целостность загруженной библиотеки
        if (!validateJSZipIntegrity(JSZip)) {
            throw new Error('Нарушена целостность библиотеки JSZip');
        }

        return JSZip;
    } catch (error) {
        const err = /** @type {Error} */ (error);
        console.error('Ошибка загрузки JSZip:', err);
        throw new Error('Не удалось загрузить библиотеку JSZip из локального файла');
    }
}

/**
 * Проверяет целостность экземпляра JSZip.
 * @param {typeof JSZip} JSZip
 * @returns {boolean}
 */
function validateJSZipIntegrity(JSZip) {
    // Проверяем основные методы JSZip для валидации целостности
    return typeof JSZip === 'function' &&
           typeof JSZip.prototype.file === 'function' &&
           typeof JSZip.prototype.folder === 'function' &&
           typeof JSZip.prototype.generateAsync === 'function';
}

/**
 * Генерирует EPUB в формате Blob.
 * @param {typeof JSZip} JSZip
 * @param {ExtractedContent} data
 * @returns {Promise<Blob>}
 */
async function generateEPUB(JSZip, data) {
    const zip = new JSZip();
    
    // 1. Создаем структуру EPUB
    
    // mimetype файл (должен быть первым и несжатым)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    
    // META-INF/container.xml
    zip.folder('META-INF');
    zip.file('META-INF/container.xml', createContainerXML());
    
    // OEBPS папка
    const oebps = zip.folder('OEBPS');
    
    // Добавляем CSS
    oebps.file('styles.css', createCSS());
    
    // Добавляем изображения
    const imageFolder = oebps.folder('images');
    const imageList = [];
    
    for (let i = 0; i < data.images.length; i++) {
        const image = data.images[i];
        const imageId = `img_${i + 1}`;
        const extension = getImageExtension(image.base64);
        const filename = `${imageId}.${extension}`;
        
        // Конвертируем base64 в binary data
        const base64Data = image.base64.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let j = 0; j < binaryData.length; j++) {
            bytes[j] = binaryData.charCodeAt(j);
        }
        
        imageFolder.file(filename, bytes);
        imageList.push({
            id: imageId,
            filename: filename,
            mediaType: `image/${extension}`
        });
    }
    
    // Создаем content.opf
    oebps.file('content.opf', createContentOPF(data, imageList));
    
    // Создаем toc.ncx
    oebps.file('toc.ncx', createTocNCX(data));
    
    // Создаем основной контент
    const processedContent = processContentWithImages(data.content, data.images, imageList);
    oebps.file('chapter1.xhtml', createChapterXHTML(data.title, processedContent));
    
    // Генерируем EPUB файл
    const epubBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });
    
    return epubBlob;
}

function createContainerXML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
}

function createContentOPF(data, imageList) {
    const uniqueId = generateUniqueId();
    const timestamp = new Date().toISOString();
    
    let manifest = `
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="css" href="styles.css" media-type="text/css"/>
        <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>`;
    
    imageList.forEach(image => {
        manifest += `\n        <item id="${image.id}" href="images/${image.filename}" media-type="${image.mediaType}"/>`;
    });
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:identifier id="BookId">${uniqueId}</dc:identifier>
        <dc:title>${escapeXML(data.title)}</dc:title>
        <dc:creator>EPUB Экспортер</dc:creator>
        <dc:language>ru</dc:language>
        <dc:date>${timestamp}</dc:date>
        <dc:source>${escapeXML(data.url)}</dc:source>
        <meta name="cover" content="cover"/>
    </metadata>
    <manifest>${manifest}
    </manifest>
    <spine toc="ncx">
        <itemref idref="chapter1"/>
    </spine>
</package>`;
}

function createTocNCX(data) {
    const uniqueId = generateUniqueId();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1" xmlns="http://www.daisy.org/z3986/2005/ncx/">
    <head>
        <meta name="dtb:uid" content="${uniqueId}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${escapeXML(data.title)}</text>
    </docTitle>
    <navMap>
        <navPoint id="navpoint-1" playOrder="1">
            <navLabel>
                <text>${escapeXML(data.title)}</text>
            </navLabel>
            <content src="chapter1.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;
}

function createChapterXHTML(title, content) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>${escapeXML(title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
    <h1>${escapeXML(title)}</h1>
    ${content}
</body>
</html>`;
}

function createCSS() {
    return `/* EPUB CSS стили для оптимального отображения на PocketBook */

body {
    font-family: "Times New Roman", Times, serif;
    font-size: 1em;
    line-height: 1.6;
    margin: 1em;
    text-align: justify;
    color: #000;
    background: #fff;
}

h1, h2, h3, h4, h5, h6 {
    font-family: Arial, sans-serif;
    margin: 1.5em 0 0.5em 0;
    page-break-after: avoid;
    color: #333;
}

h1 {
    font-size: 1.8em;
    text-align: center;
    border-bottom: 2px solid #ccc;
    padding-bottom: 0.5em;
}

h2 { font-size: 1.5em; }
h3 { font-size: 1.3em; }
h4 { font-size: 1.1em; }

p {
    margin: 0.8em 0;
    text-indent: 1.2em;
    orphans: 2;
    widows: 2;
}

blockquote {
    margin: 1em 2em;
    padding: 0.5em 1em;
    border-left: 3px solid #ccc;
    font-style: italic;
    background: #f9f9f9;
}

pre, code {
    font-family: "Courier New", monospace;
    background: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
}

pre {
    padding: 1em;
    overflow-x: auto;
    white-space: pre-wrap;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
}

ul, ol {
    margin: 1em 0;
    padding-left: 2em;
}

li {
    margin: 0.3em 0;
}

/* Оптимизация для PocketBook */
@media amzn-kf8 {
    body { font-size: 1em; }
}

@media screen and (max-device-width: 758px) {
    body { margin: 0.5em; }
    h1 { font-size: 1.5em; }
}`;
}

function processContentWithImages(content, originalImages, imageList) {
    let processedContent = content;
    
    // Заменяем ссылки на изображения на локальные
    originalImages.forEach((image, index) => {
        if (index < imageList.length) {
            const imageItem = imageList[index];
            const originalSrc = image.src;
            const newSrc = `images/${imageItem.filename}`;
            
            // Создаем регулярное выражение для поиска изображения
            const imgRegex = new RegExp(`<img[^>]*src=["']${escapeRegExp(originalSrc)}["'][^>]*>`, 'gi');
            processedContent = processedContent.replace(imgRegex, 
                `<img src="${newSrc}" alt="${escapeXML(image.alt)}" style="max-width: 100%; height: auto;"/>`
            );
        }
    });
    
    return processedContent;
}

// Вспомогательные функции
function generateFilename(title) {
    const cleanTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${cleanTitle}_${timestamp}.epub`;
}

function generateUniqueId() {
    return 'epub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

function getImageExtension(base64String) {
    if (base64String.includes('data:image/png')) return 'png';
    if (base64String.includes('data:image/gif')) return 'gif';
    if (base64String.includes('data:image/webp')) return 'webp';
    return 'jpg'; // По умолчанию
}

function escapeXML(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
