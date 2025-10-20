// @ts-check
/* global JSZip */
// EPUB Generator - Утилиты для создания EPUB файлов
// Этот модуль предоставляет дополнительные функции
/* AICODE-WHY: Typed EPUB generation ensures predictable EPUB structure and catch integration issues early [2025-08-13] */
import './jszip.min.js';
// AICODE-LINK: ./epub/assets.js
// AICODE-LINK: ./epub/templates/index.js
import {
    getMimetypeTemplate,
    getContainerTemplate,
    getContentOpfTemplate,
    getTocNcxTemplate,
    getChapterXhtmlTemplate,
    getStylesTemplate
} from './epub/templates/index.js';
import {
    sanitizeImageInputs,
    getImageExtension,
    getImageMediaType,
    decodeBase64Image
} from './epub/assets.js';

/**
 * @typedef {typeof JSZip} JSZipConstructor
 * @typedef {InstanceType<JSZipConstructor>} JSZipInstance
 */

/**
 * @typedef {Object} ImageInput
 * @property {string} src
 * @property {string} originalSrc
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
 * @property {string} id
 * @property {string} uuid
 * @property {string} timestamp
 */

class EPUBGenerator {
    constructor() {
        this.templates = {
            mimetype: getMimetypeTemplate(),
            containerXML: getContainerTemplate(),
            contentOPF: getContentOpfTemplate(),
            tocNCX: getTocNcxTemplate(),
            chapterXHTML: getChapterXhtmlTemplate(),
            styles: getStylesTemplate()
        };
    }

    // Основная функция создания EPUB
    /**
     * Создает EPUB файл на основе переданных данных.
     * @param {string} title
     * @param {string} content
     * @param {ImageInput[]} [images=[]]
     * @param {string} [url='']
     * @returns {Promise<{downloadUrl: string, filename: string, blob: Blob}>}
     */
    async createEPUB(title, content, images = [], url = '') {
        try {
            const JSZip = await this.loadJSZip();
            const zip = new JSZip();
            
            // Подготавливаем данные
            const uniqueId = this.generateUniqueId();
            const bookData = {
                title: this.sanitizeTitle(title),
                content: this.sanitizeContent(content),
                images: sanitizeImageInputs(images),
                url: url,
                uuid: uniqueId,
                id: uniqueId,
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
                filename: this.generateFilename(bookData.title),
                blob: epubBlob
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
                const extension = getImageExtension(image.base64);
                const filename = `${imageId}.${extension}`;
                const bytes = decodeBase64Image(image.base64);
                imageFolder.file(filename, bytes);
                
                imageManifest.push({
                    id: imageId,
                    filename: filename,
                    mediaType: getImageMediaType(extension),
                    originalSrc: image.originalSrc,
                    resolvedSrc: image.src
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
            const candidates = new Set();
            const pushCandidate = (value) => {
                if (value) {
                    candidates.add(value);
                }
            };

            pushCandidate(image.originalSrc);
            pushCandidate(image.resolvedSrc);

            if (bookData.url) {
                try {
                    const absolute = new URL(image.originalSrc, bookData.url).href;
                    pushCandidate(absolute);
                    pushCandidate(absolute.replace(/^https?:/, ''));
                } catch (error) {
                    // Плохой src не мешает обработке остальных изображений
                }
            }

            candidates.forEach(srcCandidate => {
                const imgRegex = new RegExp(`<img[^>]*src=["']${this.escapeRegExp(srcCandidate)}["'][^>]*>`, 'gi');
                processedContent = processedContent.replace(
                    imgRegex,
                    `<img src="images/${image.filename}" alt="" style="max-width: 100%; height: auto;"/>`
                );
            });
        });

        return this.templates.chapterXHTML
            .replace(/{{TITLE}}/g, this.escapeXML(bookData.title))
            .replace('{{CONTENT}}', processedContent);
    }

    // Утилиты
    sanitizeTitle(title) {
        return title.trim().replace(/[^\w\s-]/g, '').substring(0, 100) || 'Экспортированная статья';
    }

    sanitizeContent(content) {
        return content.trim() || '<p>Контент не найден.</p>';
    }

    generateUniqueId() {
        return 'epub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    generateFilename(title) {
        const cleanTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 50);
        const timestamp = new Date().toISOString().slice(0, 10);
        return `${cleanTitle}_${timestamp}.epub`;
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
