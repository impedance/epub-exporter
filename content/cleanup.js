// @ts-check

(() => {
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

/**
 * Получает прямой текстовый контент элемента (без вложенных элементов)
 * @param {Element} element
 * @returns {string}
 */
function getDirectTextContent(element) {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  }
  return text;
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
  listItems.forEach((item) => {
    const itemText = cleanText(item.textContent || '');
    if (itemText) {
      listContent += `    <li>${itemText}</li>\n`;
    }
  });

  if (!listContent) {
    return '';
  }
  return `<${tagName}>\n${listContent}</${tagName}>`;
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
    case 'h6': {
      const headerText = cleanText(element.textContent || '');
      return headerText ? `<${tagName}>${headerText}</${tagName}>` : '';
    }
    case 'p': {
      const paragraphText = cleanText(element.textContent || '');
      return paragraphText ? `<p>${paragraphText}</p>` : '';
    }
    case 'blockquote': {
      const quoteText = cleanText(element.textContent || '');
      return quoteText ? `<blockquote>${quoteText}</blockquote>` : '';
    }
    case 'pre': {
      const highlightedCode = element.querySelector('code[data-highlighted="yes"]');
      if (highlightedCode) {
        return `<pre><code>${highlightedCode.innerHTML}</code></pre>`;
      }
      const preText = cleanText(element.textContent || '');
      return preText ? `<pre><code>${preText}</code></pre>` : '';
    }
    case 'code': {
      if (element.getAttribute('data-highlighted') === 'yes') {
        return `<code>${element.innerHTML}</code>`;
      }
      const codeText = cleanText(element.textContent || '');
      return codeText ? `<code>${codeText}</code>` : '';
    }
    case 'ul':
    case 'ol':
      return processList(element, tagName);
    case 'img': {
      const img = /** @type {HTMLImageElement} */ (element);
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (!src) {
        return '';
      }
      const alt = cleanText(img.getAttribute('alt') || '');
      const width = img.getAttribute('width') || img.width;
      const height = img.getAttribute('height') || img.height;
      // AICODE-TRAP: TRAP/IMG-ORIGINAL-SRC preserve original src so EPUB generator can map to downloaded file [2025-08-14]
      return `<img src="${src}" alt="${alt}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}/>`;
    }
    case 'span': {
      // AICODE-NOTE: DECISION/BUBBLE-SPANS decision: Bubble HTML wraps paragraphs in span nodes; treat them as block-level text.
      const spanText = cleanText(element.textContent || '');
      return spanText ? `<p>${spanText}</p>` : '';
    }
    case 'div': {
      const directText = getDirectTextContent(element);
      return directText.trim() ? `<p>${cleanText(directText)}</p>` : '';
    }
    default:
      return '';
  }
}

if (typeof globalThis !== 'undefined') {
  /** @type {any} */ (globalThis).EpubContentCleanup = {
    cleanText,
    getDirectTextContent,
    processList,
    processElement
  };
}
})();
