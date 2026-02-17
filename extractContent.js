// @ts-check
/* global chrome, window */
// AICODE-TRAP: TRAP/CONTENT-SCRIPT-MISSING tabs.sendMessage fails if content script isn't injected [2025-08-10]
// AICODE-NOTE: DECISION/INJECT-ON-DEMAND decision: inject content script on demand for pages without automatic injection.
// AICODE-LINK: ./content_script.js#extractPageContent
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent

/** @typedef {import('./types').ExtractedImage} ExtractedImage */
/** @typedef {import('./types').ExtractedContent} ExtractedContent */

const CONTENT_SCRIPT_FILES = [
  'lib/readability.js',
  'lib/dompurify.js',
  'content/cleanup.js',
  'content/selection.js',
  'content/images.js',
  'content_script.js'
];

/**
 * Sends a content-script message and injects scripts on demand if needed.
 * @param {number} tabId
 * @param {'extractContent' | 'extractCleanContent'} action
 * @returns {Promise<{success: boolean, data?: ExtractedContent, error?: string}>}
 */
export async function sendMessageWithAutoInject(tabId, action) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action });
  } catch (err) {
    const error = /** @type {Error} */ (err);
    if (error.message && error.message.includes('Could not establish connection')) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: CONTENT_SCRIPT_FILES
      });
      return await chrome.tabs.sendMessage(tabId, { action });
    }
    throw error;
  }
}

/**
 * Отправляет запрос на извлечение контента из вкладки.
 * @param {number} tabId
 * @returns {Promise<{success: boolean, data?: ExtractedContent, error?: string}>}
 */
export async function extractContentFromTab(tabId) {
  return sendMessageWithAutoInject(tabId, 'extractContent');
}

/**
 * Отправляет запрос на извлечение "чистого" контента из вкладки.
 * @param {number} tabId
 * @returns {Promise<{success: boolean, data?: ExtractedContent, error?: string}>}
 */
export async function extractCleanContentFromTab(tabId) {
  return sendMessageWithAutoInject(tabId, 'extractCleanContent');
}

if (typeof window !== 'undefined') {
  /** @type {any} */ (window).extractContentFromTab = extractContentFromTab;
  /** @type {any} */ (window).extractCleanContentFromTab = extractCleanContentFromTab;
}
