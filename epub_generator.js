// EPUB Generator - Утилиты для создания EPUB файлов
// Этот модуль предоставляет дополнительные функции для генерации EPUB

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
    async createEPUB(title, content, images = []) {
        try {
            const JSZip = await this.loadJSZip();
            const zip = new JSZip();
            
            // Подготавливаем данные
            const bookData = {
                title: this.sanitizeTitle(title),
                content: this.sanitizeContent(content),
                images: this.processImages(images),
                id: this.generateUniqueId(),
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

            return {
                blob: epubBlob,
                filename: this.generateFilename(bookData.title),
                downloadUrl: URL.createObjectURL(epubBlob)
            };

        } catch (error) {
            console.error('Ошибка создания EPUB:', error);
            throw new Error(`Не удалось создать EPUB: ${error.message}`);
        }
    }

    // Загрузка JSZip библиотеки
    // AICODE-LINK: ./background.js#loadJSZip
    async loadJSZip() {
        if (typeof JSZip !== 'undefined') {
            // Проверяем целостность уже загруженной библиотеки
            if (!this.validateJSZipIntegrity(JSZip)) {
                throw new Error('Нарушена целостность уже загруженной библиотеки JSZip');
            }
            return JSZip;
        }

        let scriptText;
        let JSZipInstance;
        
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
                // В окружении расширения Chrome
                const jszipUrl = chrome.runtime.getURL('jszip.min.js');
                const response = await fetch(jszipUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch JSZip: ${response.status} ${response.statusText}`);
                }
                scriptText = await response.text();
            } else {
                // В Node.js окружении
                const fs = require('fs/promises');
                const path = require('path');
                const jszipPath = path.join(__dirname, 'jszip.min.js');
                scriptText = await fs.readFile(jszipPath, 'utf8');
            }

            try {
                JSZipInstance = new Function(`${scriptText}; return JSZip;`)();
            } catch (evalError) {
                if (evalError instanceof EvalError) {
                    throw new EvalError(`JSZip evaluation blocked by CSP: ${evalError.message}`);
                }
                throw evalError;
            }

            if (typeof JSZipInstance === 'undefined') {
                throw new Error('JSZip не инициализирован после загрузки из локального файла');
            }

            // Проверяем целостность загруженной библиотеки
            if (!this.validateJSZipIntegrity(JSZipInstance)) {
                throw new Error('Нарушена целостность библиотеки JSZip после загрузки');
            }

            return JSZipInstance;
        } catch (error) {
            // Очищаем глобальную переменную в случае ошибки
            if (typeof JSZipInstance !== 'undefined') {
                try {
                    delete global.JSZip;
                } catch (cleanupError) {
                    console.error('Ошибка очистки JSZip:', cleanupError);
                }
            }
            
            if (error instanceof EvalError) {
                throw error; // Пробрасываем EvalError как есть
            }
            throw new Error(`Ошибка загрузки JSZip: ${error.message}`);
        }
    }

    validateJSZipIntegrity(JSZipInstance) {
        // Проверяем основные методы JSZip для валидации целостности
        return typeof JSZipInstance === 'function' &&
               typeof JSZipInstance.prototype.file === 'function' &&
               typeof JSZipInstance.prototype.folder === 'function' &&
               typeof JSZipInstance.prototype.generateAsync === 'function';
    }

    // Построение структуры EPUB
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
                console.warn(`Ошибка обработки изображения ${i}:`, error);
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

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EPUBGenerator;
}

// Глобальная переменная для использования в браузере
if (typeof window !== 'undefined') {
    window.EPUBGenerator = EPUBGenerator;
}
