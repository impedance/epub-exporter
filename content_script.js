// @ts-check
/* global chrome */
// Content script для извлечения контента страницы
// AICODE-NOTE: NAV/CONTENT entry: extractPageContent via chrome.runtime.onMessage
/* AICODE-NOTE: DECISION/TYPE-JSDOC decision: JSDoc types formalize the content contract for reuse. */
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent
// AICODE-LINK: ./content/cleanup.js
// AICODE-LINK: ./content/selection.js
// AICODE-LINK: ./content/images.js

/** @typedef {import('./types').ExtractedImage} ExtractedImage */
/** @typedef {import('./types').ExtractedContent} ExtractedContent */
/** @typedef {import('./types').ExtensionMessage} ExtensionMessage */

/**
 * Селекторы элементов, которые не должны попадать в основной контент.
 */
const NOISE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  '.nav',
  '.navigation',
  '.menu',
  '.sidebar',
  '.ads',
  '.advertisement',
  '.social-share',
  '.comments',
  '.related-posts',
  '.popup',
  '.devsite-book-nav',
  '.devsite-book-nav-wrapper',
  '.devsite-header',
  '.devsite-footer',
  '.devsite-top-section',
  '.skip-link',
  '.button-wrapper',
  '[class*="ad-"]',
  '[id*="ad-"]',
  '#sidebar',
  '#navigation',
  '#header',
  '#footer'
];

/**
 * @returns {{
 *   cleanText: (text: string) => string,
 *   processList: (listElement: Element, tagName: string) => string,
 *   getDirectTextContent: (element: Element) => string,
 *   processElement: (element: Element) => string
 * }}
 */
function getCleanupApi() {
  const cleanup = /** @type {any} */ (globalThis).EpubContentCleanup;
  if (!cleanup) {
    throw new Error('EpubContentCleanup не загружен');
  }
  return cleanup;
}

/**
 * @returns {{
 *   hasMeaningfulSelection: (selection: Selection | null) => boolean,
 *   extractSelectedContent: (selection: Selection, noiseSelectors: string[]) => Promise<string>,
 *   isChildOfProcessedElement: (element: Element, processedElements: Set<Element>) => boolean,
 *   extractTextContentFromElement: (container: Element, noiseSelectors: string[]) => Promise<string>
 * }}
 */
function getSelectionApi() {
  const selectionApi = /** @type {any} */ (globalThis).EpubContentSelection;
  if (!selectionApi) {
    throw new Error('EpubContentSelection не загружен');
  }
  return selectionApi;
}

/**
 * @returns {{
 *   extractImagesFromSelection: (selection: Selection) => Promise<ExtractedImage[]>,
 *   extractImages: (container: Element) => Promise<ExtractedImage[]>
 * }}
 */
function getImagesApi() {
  const imagesApi = /** @type {any} */ (globalThis).EpubContentImages;
  if (!imagesApi) {
    throw new Error('EpubContentImages не загружен');
  }
  return imagesApi;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const msg = /** @type {ExtensionMessage} */ (request);

  if (msg.action === 'extractContent') {
    extractPageContent()
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (msg.action === 'extractCleanContent') {
    extractCleanPageContent()
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Извлекает "чистый" контент страницы с использованием Readability.
 * @returns {Promise<ExtractedContent>}
 */
async function extractCleanPageContent() {
  const { extractImages } = getImagesApi();
  try {
    // @ts-ignore - Readability подгружается в контент скрипт
    if (typeof Readability === 'undefined') {
      throw new Error('Модуль очистки контента не загружен');
    }

    const documentClone = /** @type {Document} */ (document.cloneNode(true));
    NOISE_SELECTORS.forEach((selector) => {
      documentClone.querySelectorAll(selector).forEach((element) => element.remove());
    });

    // @ts-ignore
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (!article || !article.content) {
      throw new Error('Не удалось извлечь основной контент страницы');
    }

    // @ts-ignore - DOMPurify подгружается в контент скрипт
    const cleanContent = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(article.content) : article.content;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanContent;
    const images = await extractImages(tempDiv);

    return {
      title: article.title || extractTitle(),
      content: cleanContent,
      images,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const cleanError = /** @type {Error} */ (error);
    console.error('Ошибка "чистого" извлечения:', cleanError);
    throw cleanError;
  }
}

/**
 * Извлекает контент страницы.
 * @returns {Promise<ExtractedContent>}
 */
async function extractPageContent() {
  const selectionApi = getSelectionApi();
  const { extractImagesFromSelection } = getImagesApi();
  try {
    // AICODE-CONTRACT: CONTRACT/SELECTION export requires explicit user selection (no auto-extract) [2026-02-10]
    const selection = window.getSelection();
    if (!selectionApi.hasMeaningfulSelection(selection)) {
      throw new Error('Сначала выделите текст на странице, затем запустите экспорт.');
    }
    const nonEmptySelection = /** @type {Selection} */ (selection);

    const title = extractTitle();
    const content = await selectionApi.extractSelectedContent(nonEmptySelection, NOISE_SELECTORS);
    const images = await extractImagesFromSelection(nonEmptySelection);

    if (!content.trim()) {
      throw new Error('Выделенный фрагмент не содержит экспортируемого контента.');
    }

    return {
      title,
      content,
      images,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const extractError = /** @type {Error} */ (error);
    console.error('Ошибка извлечения контента:', extractError);
    throw extractError;
  }
}

/**
 * Определяет заголовок страницы.
 * @returns {string}
 */
function extractTitle() {
  const { cleanText } = getCleanupApi();
  const titleSelectors = ['h1', '.step-dynamic-container h1', '.step-dynamic-container h2', '.title', '.page-title', 'title'];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (!element) {
      continue;
    }
    const cleaned = cleanText(element.textContent || '');
    if (cleaned) {
      return cleaned;
    }
  }

  return document.title || 'Экспортированная статья';
}

/**
 * @param {Selection} selection
 * @returns {Promise<string>}
 */
async function extractSelectedContent(selection) {
  const selectionApi = getSelectionApi();
  return await selectionApi.extractSelectedContent(selection, NOISE_SELECTORS);
}

/**
 * @param {Selection} selection
 * @returns {Promise<ExtractedImage[]>}
 */
async function extractImagesFromSelection(selection) {
  const { extractImagesFromSelection: extractSelectionImages } = getImagesApi();
  return await extractSelectionImages(selection);
}

/**
 * @param {Element} container
 * @returns {Promise<string>}
 */
async function extractTextContentFromElement(container) {
  const selectionApi = getSelectionApi();
  return await selectionApi.extractTextContentFromElement(container, NOISE_SELECTORS);
}

/**
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  const cleanup = getCleanupApi();
  return cleanup.cleanText(text);
}

/**
 * @param {Element} element
 * @returns {string}
 */
function getDirectTextContent(element) {
  const cleanup = getCleanupApi();
  return cleanup.getDirectTextContent(element);
}

/**
 * @param {Element} listElement
 * @param {string} tagName
 * @returns {string}
 */
function processList(listElement, tagName) {
  const cleanup = getCleanupApi();
  return cleanup.processList(listElement, tagName);
}

/**
 * @param {Element} element
 * @returns {string}
 */
function processElement(element) {
  const cleanup = getCleanupApi();
  return cleanup.processElement(element);
}

/**
 * @param {Element} element
 * @param {Set<Element>} processedElements
 * @returns {boolean}
 */
function isChildOfProcessedElement(element, processedElements) {
  const selectionApi = getSelectionApi();
  return selectionApi.isChildOfProcessedElement(element, processedElements);
}

/**
 * @param {Element} container
 * @returns {Promise<ExtractedImage[]>}
 */
async function extractImages(container) {
  const imagesApi = getImagesApi();
  return await imagesApi.extractImages(container);
}

/**
 * Вспомогательная функция для отладки.
 */
function debugExtraction() {
  const selection = window.getSelection();
  const selectionApi = getSelectionApi();
  if (selectionApi.hasMeaningfulSelection(selection)) {
    console.log('Найдено выделение:', selection?.toString().substring(0, 500) + '...');
    console.log('Количество диапазонов:', selection?.rangeCount || 0);
  } else {
    console.log('Нет выделенного текста');
    console.log('Пожалуйста, выделите текст на странице');
  }
}

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
  window.extractCleanPageContent = extractCleanPageContent;
  window.extractTextContentFromElement = extractTextContentFromElement;
  window.debugExtraction = debugExtraction;
}
