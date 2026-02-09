// @ts-check
/** @typedef {import('jszip')} JSZip */
// EPUB Generator - Утилиты для создания EPUB файлов
// Этот модуль предоставляет дополнительные функции
/* AICODE-NOTE: DECISION/EPUB-TYPED decision: typed EPUB generation keeps structure predictable and catches integration issues early. */
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
import { sanitizeXhtml } from './epub/sanitize_xhtml.js';

/**
 * @typedef {typeof import('jszip')} JSZipConstructor
 * @typedef {import('jszip')} JSZipInstance
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
    /**
     * @param {Object} [options={}]
     * @param {boolean} [options.enableContractChecks]
     * @param {Function} [options.contractValidator]
     */
    constructor(options = {}) {
        this.templates = {
            mimetype: getMimetypeTemplate(),
            containerXML: getContainerTemplate(),
            contentOPF: getContentOpfTemplate(),
            tocNCX: getTocNcxTemplate(),
            chapterXHTML: getChapterXhtmlTemplate(),
            styles: getStylesTemplate()
        };
        this.options = {
            enableContractChecks: Boolean(options.enableContractChecks),
            contractValidator: options.contractValidator || null
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
            const rawTitle = typeof title === 'string' ? title.trim() : '';
            const bookData = {
                title: this.sanitizeTitle(rawTitle),
                content: content,
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
            // AICODE-TRAP: TRAP/OBJECT-URL service workers may lack URL.createObjectURL; convert blob to data URL fallback [2025-08-14]
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                downloadUrl = URL.createObjectURL(epubBlob);
            } else {
                const buffer = await epubBlob.arrayBuffer();
                let base64;
                if (typeof btoa === 'function') {
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    const bytesLen = bytes.length;
                    for (let i = 0; i < bytesLen; i++) {
                        const byte = bytes[i];
                        if (byte !== undefined) {
                            binary += String.fromCharCode(byte);
                        }
                    }
                    base64 = btoa(binary);
                } else {
                    base64 = Buffer.from(buffer).toString('base64');
                }
                downloadUrl = `data:application/epub+zip;base64,${base64}`;
            }

            return {
                downloadUrl,
                filename: this.generateFilename(rawTitle, content),
                blob: epubBlob
            };

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
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
        // AICODE-TRAP: TRAP/JSZIP-INIT JSZip is loaded via import, but might not be ready instantly in MV3. [2025-08-12]
        // AICODE-NOTE: DECISION/JSZIP-IMPORT decision: module import loads JSZip; this function validates availability.
        // @ts-ignore
        if (typeof JSZip !== 'undefined') {
            // @ts-ignore
            const JSZipRef = JSZip;
            // Проверяем целостность уже загруженной библиотеки
            if (!this.validateJSZipIntegrity(JSZipRef)) {
                throw new Error('Нарушена целостность уже загруженной библиотеки JSZip');
            }
            return JSZipRef;
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
        // @ts-ignore
        oebps.file('styles.css', this.templates.styles);

        // Обработка изображений
        // @ts-ignore
        const imageManifest = await this.addImagesToZip(oebps, bookData.images);

        const chapters = this.buildChapterEntries(bookData, imageManifest);

        // content.opf
        const contentOPF = this.generateContentOPF(bookData, imageManifest, chapters);
        // @ts-ignore
        oebps.file('content.opf', contentOPF);

        // toc.ncx
        const tocNCX = this.generateTocNCX(bookData, chapters);
        // @ts-ignore
        oebps.file('toc.ncx', tocNCX);

        // Основной контент
        chapters.forEach((chapter) => {
            // @ts-ignore
            oebps.file(chapter.filename, chapter.xhtml);
        });
    }

    // Добавление изображений в ZIP
    /**
     * Добавляет изображения в архив и формирует их манифест.
     * @param {JSZipInstance} oebpsFolder
     * @param {ImageInput[]} images
     * @returns {Promise<Array<{id: string, filename: string, mediaType: string, originalSrc: string, resolvedSrc: string}>>}
     */
    async addImagesToZip(oebpsFolder, images) {
        const imageFolder = oebpsFolder.folder('images');
        const imageManifest = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            if (!image) continue;
            try {
                const imageId = `img_${i + 1}`;
                const extension = getImageExtension(image.base64);
                const filename = `${imageId}.${extension}`;
                const bytes = decodeBase64Image(image.base64);
                if (imageFolder) {
                    imageFolder.file(filename, bytes);
                }

                imageManifest.push({
                    id: imageId,
                    filename: filename,
                    mediaType: getImageMediaType(extension),
                    originalSrc: image.originalSrc,
                    resolvedSrc: image.src
                });
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                console.warn(`Ошибка обработки изображения ${i}:`, err);
            }
        }

        return imageManifest;
    }

    // Генерация content.opf
    /**
     * @param {BookData} bookData
     * @param {Array<{id: string, filename: string, mediaType: string}>} imageManifest
     * @param {Array<{id: string, filename: string}>} [chapters=[]]
     * @returns {string}
     */
    generateContentOPF(bookData, imageManifest, chapters = []) {
        const chapterEntries = chapters.length
            ? chapters
            : [{ id: 'chapter1', filename: 'chapter1.xhtml' }];

        let manifest = `
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="css" href="styles.css" media-type="text/css"/>`;

        chapterEntries.forEach(chapter => {
            manifest += `\n        <item id="${chapter.id}" href="${chapter.filename}" media-type="application/xhtml+xml"/>`;
        });

        imageManifest.forEach(image => {
            manifest += `\n        <item id="${image.id}" href="images/${image.filename}" media-type="${image.mediaType}"/>`;
        });

        const spine = chapterEntries
            .map(chapter => `        <itemref idref="${chapter.id}"/>`)
            .join('\n');

        return this.templates.contentOPF
            .replace('{{BOOK_ID}}', bookData.id)
            .replace('{{TITLE}}', this.escapeXML(bookData.title))
            .replace('{{TIMESTAMP}}', bookData.timestamp)
            .replace('{{MANIFEST}}', manifest)
            .replace('{{SPINE}}', spine);
    }

    // Генерация toc.ncx
    /**
     * @param {BookData} bookData
     * @param {Array<{id: string, filename: string, title?: string}>} [chapters=[]]
     * @returns {string}
     */
    generateTocNCX(bookData, chapters = []) {
        const chapterEntries = chapters.length
            ? chapters
            : [{ id: 'chapter1', filename: 'chapter1.xhtml', title: bookData.title }];

        const navPoints = chapterEntries
            .map((chapter, index) => {
                const playOrder = index + 1;
                return `        <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
            <navLabel>
                <text>${this.escapeXML(chapter.title || bookData.title)}</text>
            </navLabel>
            <content src="${chapter.filename}"/>
        </navPoint>`;
            })
            .join('\n');

        return this.templates.tocNCX
            .replace(/{{BOOK_ID}}/g, bookData.id)
            .replace(/{{TITLE}}/g, this.escapeXML(bookData.title))
            .replace('{{NAV_POINTS}}', navPoints);
    }

    // Генерация chapter XHTML
    /**
     * @param {BookData} bookData
     * @param {Array<{id: string, filename: string, mediaType: string, originalSrc: string, resolvedSrc: string}>} imageManifest
     * @returns {string}
     */
    generateChapterXHTML(bookData, imageManifest) {
        let processedContent = bookData.content;

        // Замена ссылок на изображения
        imageManifest.forEach(image => {
            if (!image) return;
            const candidates = new Set();
            /** @param {string} value */
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
    /** @param {string} title */
    sanitizeTitle(title) {
        return title.trim().replace(/[^\w\s-]/g, '').substring(0, 100) || 'Экспортированная статья';
    }

    /** @param {string} content */
    sanitizeContent(content) {
        const trimmed = content.trim();
        if (!trimmed) {
            return sanitizeXhtml('<p>Контент не найден.</p>');
        }
        return sanitizeXhtml(trimmed);
    }

    // AICODE-NOTE: DECISION/POCKETBOOK-XHTML decision: normalize content to PocketBook-safe XHTML ref: docs/decisions/ADR-0002-pocketbook-xhtml-contract.md
    /** @param {string} html */
    normalizePocketbookXhtml(html) {
        return sanitizeXhtml(html).xhtml;
    }

    /**
     * @param {BookData} bookData
     * @param {Array<{id: string, filename: string, mediaType: string, originalSrc: string, resolvedSrc: string}>} imageManifest
     * @returns {Array<{id: string, filename: string, title: string, xhtml: string}>}
     */
    buildChapterEntries(bookData, imageManifest) {
        const { xhtml: sanitizedContent } = this.sanitizeContent(bookData.content);
        const chapterContents = this.splitContentIntoChapters(sanitizedContent);
        return chapterContents.map((content, index) => {
            const chapterTitle = this.getChapterTitle(bookData.title, index, chapterContents.length);
            const chapterData = {
                ...bookData,
                title: chapterTitle,
                content
            };
            const chapterXhtml = this.generateChapterXHTML(chapterData, imageManifest);
            this.assertContractIfEnabled(chapterXhtml, {
                title: chapterTitle,
                index
            });
            return {
                id: `chapter${index + 1}`,
                filename: `chapter${index + 1}.xhtml`,
                title: chapterTitle,
                xhtml: chapterXhtml
            };
        });
    }

    /**
     * @param {string} baseTitle
     * @param {number} index
     * @param {number} total
     * @returns {string}
     */
    getChapterTitle(baseTitle, index, total) {
        if (total <= 1) {
            return baseTitle;
        }
        if (index === 0) {
            return baseTitle;
        }
        return `${baseTitle} — Часть ${index + 1}`;
    }

    /**
     * @param {string} html
     * @returns {string[]}
     */
    splitContentIntoChapters(html) {
        const blockCount = this.countMatches(html, /<(p|h[1-6]|pre|blockquote|ul|ol|li|div|section|article|table)\b/gi);
        const imageCount = this.countMatches(html, /<img\b/gi);
        const preCount = this.countMatches(html, /<pre\b/gi);

        const thresholds = {
            maxChars: preCount > 0 ? 80000 : 120000,
            maxBlocks: preCount > 0 ? 150 : 220,
            maxImages: 30
        };

        if (html.length <= thresholds.maxChars &&
            blockCount <= thresholds.maxBlocks &&
            imageCount <= thresholds.maxImages) {
            return [html];
        }

        const blocks = this.extractChapterBlocks(html);
        if (blocks.length === 0) {
            return [html];
        }

        const chapters = [];
        let current = '';
        let currentChars = 0;
        let currentBlocks = 0;
        let currentImages = 0;

        blocks.forEach((block) => {
            const blockImages = this.countMatches(block, /<img\b/gi);
            const nextChars = currentChars + block.length;
            const nextBlocks = currentBlocks + 1;
            const nextImages = currentImages + blockImages;

            if (current &&
                (nextChars > thresholds.maxChars ||
                    nextBlocks > thresholds.maxBlocks ||
                    nextImages > thresholds.maxImages)) {
                chapters.push(current);
                current = '';
                currentChars = 0;
                currentBlocks = 0;
                currentImages = 0;
            }

            current += block;
            currentChars += block.length;
            currentBlocks += 1;
            currentImages += blockImages;
        });

        if (current) {
            chapters.push(current);
        }

        return chapters.length ? chapters : [html];
    }

    /**
     * @param {string} html
     * @returns {string[]}
     */
    extractChapterBlocks(html) {
        const blocks = [];
        const blockRegex = /<(h[1-6]|p|pre|blockquote|ul|ol|li|div|section|article|table)\b[^>]*>[\s\S]*?<\/\1>|<hr\b[^>]*\/>|<br\b[^>]*\/>|<img\b[^>]*\/?>/gi;
        let lastIndex = 0;
        let match;

        while ((match = blockRegex.exec(html)) !== null) {
            if (match.index > lastIndex) {
                const loose = html.slice(lastIndex, match.index);
                const wrapped = this.wrapLooseText(loose);
                if (wrapped) {
                    blocks.push(wrapped);
                }
            }

            blocks.push(match[0]);
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < html.length) {
            const loose = html.slice(lastIndex);
            const wrapped = this.wrapLooseText(loose);
            if (wrapped) {
                blocks.push(wrapped);
            }
        }

        return blocks;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    wrapLooseText(text) {
        const trimmed = text.trim();
        if (!trimmed) {
            return '';
        }
        return `<p>${trimmed}</p>`;
    }

    /**
     * @param {string} text
     * @param {RegExp} regex
     * @returns {number}
     */
    countMatches(text, regex) {
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }

    /**
     * @param {string} xhtml
     * @param {Object} [context={}]
     */
    assertContractIfEnabled(xhtml, context = {}) {
        if (!this.options.enableContractChecks || !this.options.contractValidator) {
            return;
        }
        const errors = this.options.contractValidator(xhtml, context) || [];
        if (errors.length > 0) {
            throw new Error(`PocketBook XHTML contract failed: ${errors.join(', ')}`);
        }
    }

    generateUniqueId() {
        return 'epub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * @param {string} title
     * @param {string} content
     * @returns {string}
     */
    generateFilename(title, content) {
        const titleSlug = this.buildSlugFromText(title);
        if (titleSlug) {
            return `${titleSlug}.epub`;
        }

        const contentSlug = this.buildSlugFromText(this.extractFirstSentence(content));
        if (contentSlug) {
            return `${contentSlug}.epub`;
        }

        return `${this.formatTimestampForFilename(new Date())}.epub`;
    }

    /**
     * @param {string} text
     * @param {number} [maxWords=3]
     * @returns {string}
     */
    buildSlugFromText(text, maxWords = 3) {
        if (typeof text !== 'string') {
            return '';
        }

        const normalized = this.transliterateToAscii(text)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

        if (!normalized) {
            return '';
        }

        const words = normalized
            .split(' ')
            .filter(word => word.length >= 2)
            .slice(0, maxWords);

        return words.join('-');
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    transliterateToAscii(text) {
        /** @type {Record<string, string>} */
        const map = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
            'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
            'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
            'я': 'ya'
        };

        let output = '';
        if (typeof text !== 'string') return output;
        for (const char of text.toLowerCase()) {
            const mapped = map[char];
            if (mapped !== undefined) {
                output += mapped;
                continue;
            }
            output += char;
        }
        return output;
    }

    /**
     * @param {string} content
     * @returns {string}
     */
    extractFirstSentence(content) {
        if (typeof content !== 'string') {
            return '';
        }

        const text = content
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;|&amp;|&quot;|&lt;|&gt;|&apos;/gi, ' ')
            .replace(/&[a-z0-9#]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!text) {
            return '';
        }

        const sentence = text.split(/[.!?]+/).map(part => part.trim()).find(Boolean);
        return sentence || text;
    }

    /**
     * @param {Date} date
     * @returns {string}
     */
    formatTimestampForFilename(date) {
        /** @type {(value: number | string) => string} */
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    escapeXML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * @param {string} string
     * @returns {string}
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

export default EPUBGenerator;
