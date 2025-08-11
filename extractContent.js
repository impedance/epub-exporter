// @ts-check
/* global chrome, window */
// AICODE-TRAP: tabs.sendMessage fails if content script isn't injected [2025-08-10]
// AICODE-WHY: Inject content script on demand to handle pages without automatic injection [2025-08-10]
// AICODE-LINK: ./content_script.js#extractPageContent
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent

/** @typedef {import('./types').ExtractedImage} ExtractedImage */
/** @typedef {import('./types').ExtractedContent} ExtractedContent */

/**
 * Отправляет запрос на извлечение контента из вкладки.
 * @param {number} tabId
 * @returns {Promise<{success: boolean, data?: ExtractedContent, error?: string}>}
 */
export async function extractContentFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
  } catch (err) {
    const error = /** @type {Error} */ (err);
    if (error.message && error.message.includes('Could not establish connection')) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content_script.js']
      });
      return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    }
    throw error;
  }
}

if (typeof window !== 'undefined') {
  /** @type {any} */ (window).extractContentFromTab = extractContentFromTab;
}

