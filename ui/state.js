// @ts-check

/**
 * @param {string} url
 * @returns {{allowed: boolean, message: string, type: '' | 'error'}}
 */
export function getExportAvailability(url) {
  if (!url) {
    return { allowed: false, message: '⚠️ Экспорт недоступен', type: 'error' };
  }

  if (url.startsWith('https://chrome.google.com/webstore')) {
    return {
      allowed: false,
      message: '⚠️ Chrome Web Store ограничивает работу всех расширений на своих страницах.',
      type: 'error'
    };
  }

  const restrictedSchemes = [
    'chrome:',
    'chrome-extension:',
    'about:',
    'view-source:',
    'edge:',
    'devtools:',
    'data:'
  ];

  if (restrictedSchemes.some((scheme) => url.startsWith(scheme))) {
    return { allowed: false, message: '⚠️ Экспорт недоступен для системных страниц', type: 'error' };
  }

  return { allowed: true, message: 'Готов к экспорту', type: '' };
}

/**
 * @param {typeof chrome} chromeApi
 * @returns {Promise<chrome.tabs.Tab | undefined>}
 */
export async function getActiveTab(chromeApi) {
  const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}
