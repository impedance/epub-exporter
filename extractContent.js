// @ts-check
/* global chrome, window */
// AICODE-TRAP: TRAP/CONTENT-SCRIPT-MISSING tabs.sendMessage fails if content script isn't injected [2025-08-10]
// AICODE-NOTE: DECISION/INJECT-ON-DEMAND decision: inject content script on demand for pages without automatic injection.
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
        files: ['lib/readability.js', 'lib/dompurify.js', 'content_script.js']
      });
      return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    }
    throw error;
  }
}

if (typeof window !== 'undefined') {
  /** @type {any} */ (window).extractContentFromTab = extractContentFromTab;
}
