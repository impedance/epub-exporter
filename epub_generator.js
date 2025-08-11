// @ts-check
/* global JSZip */
// EPUB Generator - Утилиты для создания EPUB файлов
// Этот модуль предоставляет дополнительные функции
/* AICODE-WHY: Typed EPUB generation ensures predictable EPUB structure and catch integration issues early [2025-08-13] */
import './jszip.min.js';

/**
 * @typedef {typeof JSZip} JSZipConstructor
 * @typedef {InstanceType<JSZipConstructor>} JSZipInstance
 */

/**
 * @typedef {Object} ImageInput
 * @property {string} src
 * @property {string} base64
 * @property {string} [alt]
 * @property {number|string} [width]
 * @property {number|string} [height]
 */

/**
 * @typedef {Object} BookData
 * @property {string} title
 * @property {string} content
 * @property {ImageInput[]} images
 * @property {string} url
 * @property {string} uuid
 * @property {string} timestamp
 */

class EPUBGenerator {
    constructor() {
        this.templates = {
            mimetype: 'application/epub+zip',
            containerXML: this.getContainerTemplate(),
            contentOPF: this.getContentOPFTemplate(),
            tocNCX: this.getTocNCXTemplate(),
            chapterXHTML: this.getChapterXHTMLTemplate(),
            styles: this.getStylesTemplate()
        };
    }

    // Основная функция создания EPUB
    /**
     * Создает EPUB файл на основе переданных данных.
     * @param {string} title
     * @param {string} content
     * @param {ImageInput[]} [images=[]]
     * @param {string} [url='']
     * @returns {Promise<{downloadUrl: string, filename: string}>}
     */
    async createEPUB(title, content, images = [], url = '') {
        try {
            const JSZip = await this.loadJSZip();
            const zip = new JSZip();
            
            // Подготавливаем данные
            const bookData = {
                title: this.sanitizeTitle(title),
                content: this.sanitizeContent(content),
                images: this.processImages(images),
                url: url,
                uuid: this.generateUniqueId(),
                timestamp: new Date().toISOString()
            };

            // Создаем структуру EPUB
            await this.buildEPUBStructure(zip, bookData);
            
            // Генерируем файл
            const epubBlob = await zip.generateAsync({
                type: 'blob',
                mimeType: 'application/epub+zip',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
            });

            let downloadUrl;
            // AICODE-TRAP: Service workers may lack URL.createObjectURL; convert blob to data URL fallback [2025-08-14]
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                downloadUrl = URL.createObjectURL(epubBlob);
            } else {
                const buffer = await epubBlob.arrayBuffer();
                let base64;
                if (typeof btoa === 'function') {
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    base64 = btoa(binary);
                } else {
                    base64 = Buffer.from(buffer).toString('base64');
                }
                downloadUrl = `data:application/epub+zip;base64,${base64}`;
            }

            return {
                downloadUrl,
                filename: this.generateFilename(bookData.title)
            };

        } catch (error) {
            const err = /** @type {Error} */ (error);
            console.error('Ошибка создания EPUB:', err);
            throw new Error(`Не удалось создать EPUB: ${err.message}`);
        }
    }

    // Загрузка JSZip библиотеки
    // AICODE-LINK: ./background.js#createEPUBFile
    /**
     * Загружает и валидирует JSZip из глобальной области видимости.
     * @returns {Promise<JSZipConstructor>}
     */
    async loadJSZip() {
        // AICODE-TRAP: JSZip is loaded into global scope via import in Manifest V3 modules, but might not be ready instantly. [2025-08-12]
        // AICODE-WHY: The import at the top of the module handles loading. This function now just validates that it's loaded. [2025-08-12]
        if (typeof JSZip !== 'undefined') {
            // Проверяем целостность уже загруженной библиотеки
            if (!this.validateJSZipIntegrity(JSZip)) {
                throw new Error('Нарушена целостность уже загруженной библиотеки JSZip');
            }
            return JSZip;
        }
        throw new Error('Библиотека JSZip не загружена. Проверьте импорт в модуле.');
    }

    /**
     * Проверяет наличие ключевых методов в экземпляре JSZip.
     * @param {JSZipConstructor} JSZipInstance
     * @returns {boolean}
     */
    validateJSZipIntegrity(JSZipInstance) {
        // Проверяем основные методы JSZip для валидации целостности
        return typeof JSZipInstance === 'function' &&
               typeof JSZipInstance.prototype.file === 'function' &&
               typeof JSZipInstance.prototype.folder === 'function' &&
               typeof JSZipInstance.prototype.generateAsync === 'function';
    }

    // Построение структуры EPUB
    /**
     * Формирует структуру EPUB в архиве.
     * @param {JSZipInstance} zip
     * @param {BookData} bookData
     * @returns {Promise<void>}
     */
    async buildEPUBStructure(zip, bookData) {
        // mimetype (несжатый)
        zip.file('mimetype', this.templates.mimetype, { compression: 'STORE' });

        // META-INF/container.xml
        zip.folder('META-INF');
        zip.file('META-INF/container.xml', this.templates.containerXML);

        // OEBPS структура
        const oebps = zip.folder('OEBPS');
        
        // CSS стили
        oebps.file('styles.css', this.templates.styles);

        // Обработка изображений
        const imageManifest = await this.addImagesToZip(oebps, bookData.images);

        // content.opf
        const contentOPF = this.generateContentOPF(bookData, imageManifest);
        oebps.file('content.opf', contentOPF);

        // toc.ncx
        const tocNCX = this.generateTocNCX(bookData);
        oebps.file('toc.ncx', tocNCX);

        // Основной контент
        const chapterContent = this.generateChapterXHTML(bookData, imageManifest);
        oebps.file('chapter1.xhtml', chapterContent);
    }

    // Добавление изображений в ZIP
    /**
     * Добавляет изображения в архив и формирует их манифест.
     * @param {JSZipInstance} oebpsFolder
     * @param {ImageInput[]} images
     * @returns {Promise<Array<{id: string, filename: string, mediaType: string}>>}
     */
    async addImagesToZip(oebpsFolder, images) {
        const imageFolder = oebpsFolder.folder('images');
        const imageManifest = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            try {
                const imageId = `img_${i + 1}`;
                const extension = this.getImageExtension(image.base64);
                const filename = `${imageId}.${extension}`;

                // Конвертация base64 в binary
                const base64Data = image.base64.split(',')[1];
                const binaryData = atob(base64Data);
                const bytes = new Uint8Array(binaryData.length);
                
                for (let j = 0; j < binaryData.length; j++) {
                    bytes[j] = binaryData.charCodeAt(j);
                }

                imageFolder.file(filename, bytes);
                
                imageManifest.push({
                    id: imageId,
                    filename: filename,
                    mediaType: `image/${extension}`,
                    originalSrc: image.src
                });
            } catch (error) {
                const err = /** @type {Error} */ (error);
                console.warn(`Ошибка обработки изображения ${i}:`, err);
            }
        }

        return imageManifest;
    }

    // Генерация content.opf
    generateContentOPF(bookData, imageManifest) {
        let manifest = `
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="css" href="styles.css" media-type="text/css"/>
        <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>`;

        imageManifest.forEach(image => {
            manifest += `\n        <item id="${image.id}" href="images/${image.filename}" media-type="${image.mediaType}"/>`;
        });

        return this.templates.contentOPF
            .replace('{{BOOK_ID}}', bookData.id)
            .replace('{{TITLE}}', this.escapeXML(bookData.title))
            .replace('{{TIMESTAMP}}', bookData.timestamp)
            .replace('{{MANIFEST}}', manifest);
    }

    // Генерация toc.ncx
    generateTocNCX(bookData) {
        return this.templates.tocNCX
            .replace(/{{BOOK_ID}}/g, bookData.id)
            .replace(/{{TITLE}}/g, this.escapeXML(bookData.title));
    }

    // Генерация chapter XHTML
    generateChapterXHTML(bookData, imageManifest) {
        let processedContent = bookData.content;

        // Замена ссылок на изображения
        imageManifest.forEach(image => {
            const imgRegex = new RegExp(`<img[^>]*src=["']${this.escapeRegExp(image.originalSrc)}["'][^>]*>`, 'gi');
            processedContent = processedContent.replace(imgRegex, 
                `<img src="images/${image.filename}" alt="" style="max-width: 100%; height: auto;"/>`
            );
        });

        return this.templates.chapterXHTML
            .replace(/{{TITLE}}/g, this.escapeXML(bookData.title))
            .replace('{{CONTENT}}', processedContent);
    }

    // Шаблоны
    getContainerTemplate() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
    }

    getContentOPFTemplate() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:identifier id="BookId">{{BOOK_ID}}</dc:identifier>
        <dc:title>{{TITLE}}</dc:title>
        <dc:creator>EPUB Экспортер</dc:creator>
        <dc:language>ru</dc:language>
        <dc:date>{{TIMESTAMP}}</dc:date>
        <meta name="cover" content="cover"/>
    </metadata>
    <manifest>{{MANIFEST}}
    </manifest>
    <spine toc="ncx">
        <itemref idref="chapter1"/>
    </spine>
</package>`;
    }

    getTocNCXTemplate() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx version="2005-1" xmlns="http://www.daisy.org/z3986/2005/ncx/">
    <head>
        <meta name="dtb:uid" content="{{BOOK_ID}}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>{{TITLE}}</text>
    </docTitle>
    <navMap>
        <navPoint id="navpoint-1" playOrder="1">
            <navLabel>
                <text>{{TITLE}}</text>
            </navLabel>
            <content src="chapter1.xhtml"/>
        </navPoint>
    </navMap>
</ncx>`;
    }

    getChapterXHTMLTemplate() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>{{TITLE}}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
    <h1>{{TITLE}}</h1>
    {{CONTENT}}
</body>
</html>`;
    }

    getStylesTemplate() {
        return `/* Стили для PocketBook EPUB */
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

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
}

pre, code {
    font-family: "Courier New", monospace;
    background: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
}

ul, ol {
    margin: 1em 0;
    padding-left: 2em;
}

li {
    margin: 0.3em 0;
}`;
    }

    // Утилиты
    sanitizeTitle(title) {
        return title.trim().replace(/[^\w\s-]/g, '').substring(0, 100) || 'Экспортированная статья';
    }

    sanitizeContent(content) {
        return content.trim() || '<p>Контент не найден.</p>';
    }

    processImages(images) {
        return images.filter(img => img.base64 && img.src);
    }

    generateUniqueId() {
        return 'epub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    generateFilename(title) {
        const cleanTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 50);
        const timestamp = new Date().toISOString().slice(0, 10);
        return `${cleanTitle}_${timestamp}.epub`;
    }

    getImageExtension(base64String) {
        if (base64String.includes('data:image/png')) return 'png';
        if (base64String.includes('data:image/gif')) return 'gif';
        if (base64String.includes('data:image/webp')) return 'webp';
        return 'jpg';
    }

    escapeXML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

export default EPUBGenerator;
