// AICODE-TRAP: tabs.sendMessage fails if content script isn't injected [2025-08-10]
// AICODE-WHY: Inject content script on demand to handle pages without automatic injection [2025-08-10]
async function extractContentFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
  } catch (err) {
    if (err.message && err.message.includes('Could not establish connection')) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content_script.js']
      });
      return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    }
    throw err;
  }
}

if (typeof window !== 'undefined') {
  window.extractContentFromTab = extractContentFromTab;
}

if (typeof module !== 'undefined') {
  module.exports = { extractContentFromTab };
}
