// @ts-check

(() => {
/**
 * @typedef {{
 *   cleanText: (text: string) => string,
 *   processElement: (element: Element) => string
 * }} CleanupApi
 */

/**
 * @returns {CleanupApi}
 */
function getCleanupApi() {
  const cleanup = /** @type {any} */ (globalThis).EpubContentCleanup;
  if (!cleanup || typeof cleanup.cleanText !== 'function' || typeof cleanup.processElement !== 'function') {
    throw new Error('EpubContentCleanup не инициализирован');
  }
  return cleanup;
}

/**
 * @param {Selection | null} selection
 * @returns {boolean}
 */
function hasMeaningfulSelection(selection) {
  return Boolean(selection && selection.rangeCount > 0 && selection.toString().trim() !== '');
}

/**
 * @param {Selection} selection
 * @returns {HTMLDivElement}
 */
function cloneSelectionToContainer(selection) {
  const tempDiv = document.createElement('div');
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    tempDiv.appendChild(range.cloneContents());
  }
  return tempDiv;
}

/**
 * Проверяет, является ли элемент потомком уже обработанного элемента.
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
 * Извлекает текстовое содержимое из элемента.
 * @param {Element} container
 * @param {string[]} noiseSelectors
 * @returns {Promise<string>}
 */
async function extractTextContentFromElement(container, noiseSelectors) {
  const { cleanText, processElement } = getCleanupApi();
  const clone = /** @type {HTMLElement} */ (container.cloneNode(true));

  noiseSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((element) => element.remove());
  });

  let formattedContent = '';
  const processedElements = new Set();

  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const element = /** @type {Element} */ (node);
      const tagName = element.tagName.toLowerCase();
      if (
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'code', 'div', 'img', 'span'].includes(
          tagName
        )
      ) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    }
  });

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    const element = /** @type {Element} */ (currentNode);
    if (processedElements.has(element) || isChildOfProcessedElement(element, processedElements)) {
      continue;
    }

    const content = processElement(element);
    if (content.trim()) {
      formattedContent += `${content}\n`;
      processedElements.add(element);
    }
  }

  if (formattedContent.trim()) {
    return formattedContent;
  }

  const allText = cleanText(clone.textContent || '');
  if (!allText) {
    return '';
  }

  const paragraphs = allText.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  return paragraphs.map((paragraph) => `<p>${paragraph.trim()}</p>`).join('\n');
}

/**
 * Извлекает выделенное содержимое.
 * @param {Selection} selection
 * @param {string[]} noiseSelectors
 * @returns {Promise<string>}
 */
async function extractSelectedContent(selection, noiseSelectors) {
  const { cleanText } = getCleanupApi();
  try {
    const tempDiv = cloneSelectionToContainer(selection);
    return await extractTextContentFromElement(tempDiv, noiseSelectors);
  } catch (error) {
    const selectedText = selection.toString().trim();
    if (!selectedText) {
      return '';
    }
    const paragraphs = selectedText.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    if (paragraphs.length > 1) {
      return paragraphs.map((paragraph) => `<p>${cleanText(paragraph.trim())}</p>`).join('\n');
    }
    return `<p>${cleanText(selectedText)}</p>`;
  }
}

if (typeof globalThis !== 'undefined') {
  /** @type {any} */ (globalThis).EpubContentSelection = {
    hasMeaningfulSelection,
    cloneSelectionToContainer,
    isChildOfProcessedElement,
    extractTextContentFromElement,
    extractSelectedContent
  };
}
})();
