// @ts-check

import { getActiveTab, getExportAvailability } from './state.js';

/**
 * @typedef {import('../types').CreateEPUBResponse} CreateEPUBResponse
 */

/**
 * @param {{
 *   chromeApi: typeof chrome,
 *   extractContentFromTab: (tabId: number) => Promise<{success: boolean, data?: any, error?: string}>,
 *   extractCleanContentFromTab: (tabId: number) => Promise<{success: boolean, data?: any, error?: string}>,
 *   dropboxClient: {isConnected: () => Promise<boolean>},
 *   gmailClient: {isConnected: () => Promise<boolean>},
 *   view: {
 *     setStatus: (message: string, type?: string) => void,
 *     renderWorkflowStage: (stage: 'init'|'extract'|'epub'|'upload'|'kindle'|'done', options: {dropbox: boolean, kindle: boolean}) => void,
 *     setProgress: (percent: number, controls: HTMLButtonElement[]) => void
 *   },
 *   elements: {
 *     exportBtn: HTMLButtonElement,
 *     uploadToDropboxBtn: HTMLButtonElement,
 *     sendToKindleBtn: HTMLButtonElement,
 *     previewBtn: HTMLButtonElement,
 *     dropboxStatus: HTMLDivElement,
 *     kindleStatus: HTMLDivElement
 *   },
 *   debugLog: (...args: any[]) => void
 * }} deps
 */
export function createPopupHandlers(deps) {
  const {
    chromeApi,
    extractContentFromTab,
    extractCleanContentFromTab,
    dropboxClient,
    gmailClient,
    view,
    elements,
    debugLog
  } = deps;
  const controls = [
    elements.exportBtn,
    elements.uploadToDropboxBtn,
    elements.sendToKindleBtn,
    elements.previewBtn
  ];

  async function updateDropboxStatus() {
    try {
      const isConnected = await dropboxClient.isConnected();
      debugLog('Dropbox connection status', { isConnected });

      if (isConnected) {
        elements.dropboxStatus.textContent = '📁 Dropbox подключен';
        elements.dropboxStatus.className = 'dropbox-status connected';
        elements.uploadToDropboxBtn.disabled = false;
      } else {
        elements.dropboxStatus.textContent = '📁 Dropbox не подключен';
        elements.dropboxStatus.className = 'dropbox-status disconnected';
        elements.uploadToDropboxBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error updating Dropbox status:', error);
    }
  }

  async function updateGmailStatus() {
    try {
      const isConnected = await gmailClient.isConnected();
      debugLog('Gmail connection status', { isConnected });

      if (isConnected) {
        elements.kindleStatus.textContent = '📧 Gmail подключен';
        elements.kindleStatus.className = 'kindle-status connected';
        elements.sendToKindleBtn.disabled = false;
      } else {
        elements.kindleStatus.textContent = '📧 Gmail не подключен';
        elements.kindleStatus.className = 'kindle-status disconnected';
        elements.sendToKindleBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error updating Gmail status:', error);
    }
  }

  async function checkExportAvailability() {
    try {
      const tab = await getActiveTab(chromeApi);
      debugLog('Active tab info', tab);
      const url = tab?.url || '';
      const availability = getExportAvailability(url);

      view.setStatus(availability.message, availability.type);
      elements.exportBtn.disabled = !availability.allowed;
      elements.previewBtn.disabled = !availability.allowed;
    } catch (error) {
      console.error('Error checking export availability:', error);
      view.setStatus('⚠️ Ошибка доступа к контенту страницы. Попробуйте обновить страницу.', 'error');
      elements.exportBtn.disabled = true;
      elements.previewBtn.disabled = true;
    }
  }

  async function initializePopup() {
    try {
      debugLog('Initializing popup');
      await Promise.all([updateDropboxStatus(), updateGmailStatus()]);
      await checkExportAvailability();
    } catch (error) {
      console.error('Error initializing popup:', error);
    }
  }

  /**
   * @param {{uploadToDropbox: boolean, sendToKindle: boolean}} options
   */
  async function handleExport(options) {
    const { uploadToDropbox: shouldUploadToDropbox, sendToKindle: shouldSendToKindle } = options;
    debugLog('Starting export flow', { shouldUploadToDropbox, shouldSendToKindle });

    try {
      view.renderWorkflowStage('init', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
      view.setProgress(5, controls);

      const tab = await getActiveTab(chromeApi);
      if (!tab?.id) {
        throw new Error('Не удалось получить текущую вкладку');
      }

      view.renderWorkflowStage('extract', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
      view.setProgress(20, controls);

      const response = await extractContentFromTab(tab.id);
      debugLog('Content extraction response', response);
      if (!response || !response.success) {
        throw new Error(response?.error || 'Не удалось извлечь контент');
      }

      view.renderWorkflowStage('epub', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
      view.setProgress(40, controls);

      const epubResponse = /** @type {CreateEPUBResponse} */ (
        await chromeApi.runtime.sendMessage({
          action: 'createEPUB',
          data: response.data,
          uploadToDropbox: shouldUploadToDropbox,
          sendToKindle: shouldSendToKindle
        })
      );

      if (!epubResponse || !epubResponse.success) {
        throw new Error(epubResponse?.error || 'Ошибка создания EPUB');
      }

      if (shouldUploadToDropbox) {
        view.renderWorkflowStage('upload', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
        view.setProgress(60, controls);
      }
      if (shouldSendToKindle) {
        view.renderWorkflowStage('kindle', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
        view.setProgress(shouldUploadToDropbox ? 80 : 70, controls);
      }

      view.renderWorkflowStage('done', { dropbox: shouldUploadToDropbox, kindle: shouldSendToKindle });
      view.setProgress(100, controls);

      if (!shouldSendToKindle) {
        await chromeApi.downloads.download({
          url: epubResponse.downloadUrl || '',
          filename: epubResponse.filename || ''
        });
      }

      const successMessage = ['✅ EPUB файл успешно создан!'];
      if (shouldUploadToDropbox) {
        successMessage.push('📁 Загружен в Dropbox.');
      }
      if (shouldSendToKindle) {
        successMessage.push('📩 Отправлен на Kindle.');
      }
      view.setStatus(successMessage.join('<br>'), 'success');

      setTimeout(() => {
        if (typeof window !== 'undefined' && typeof window.close === 'function') {
          window.close();
        }
      }, 3000);

      view.setProgress(0, controls);
      await checkExportAvailability();
      await Promise.all([updateDropboxStatus(), updateGmailStatus()]);
    } catch (error) {
      const exportError = /** @type {Error} */ (error);
      console.error('Ошибка экспорта:', exportError);
      view.setStatus(`❌ ${exportError.message}`, 'error');
      view.setProgress(0, controls);
      await checkExportAvailability();
      await Promise.all([updateDropboxStatus(), updateGmailStatus()]);
    }
  }

  async function handlePreview() {
    debugLog('Starting clean preview flow');
    try {
      view.setStatus('⌛ Подготовка предпросмотра...');
      elements.previewBtn.disabled = true;
      elements.exportBtn.disabled = true;

      const tab = await getActiveTab(chromeApi);
      if (!tab?.id) {
        throw new Error('Не удалось получить текущую вкладку');
      }

      const response = await extractCleanContentFromTab(tab.id);
      if (!response || !response.success || !response.data) {
        throw new Error(response?.error || 'Не удалось извлечь контент');
      }

      const { title, content } = response.data;
      const previewHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Предпросмотр: ${title}</title>
                    <style>
                        body {
                            max-width: 800px;
                            margin: 40px auto;
                            padding: 0 20px;
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            background-color: #f9f9f9;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
                        img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>${title}</h1>
                        ${content}
                    </div>
                </body>
                </html>
            `;

      const blob = new Blob([previewHtml], { type: 'text/html' });
      const previewUrl = URL.createObjectURL(blob);
      chromeApi.tabs.create({ url: previewUrl });

      view.setStatus('✅ Предпросмотр открыт в новой вкладке');

      setTimeout(() => {
        elements.previewBtn.disabled = false;
        elements.exportBtn.disabled = false;
        view.setStatus('Готов к экспорту');
      }, 1000);
    } catch (error) {
      const previewError = /** @type {Error} */ (error);
      console.error('Ошибка предпросмотра:', previewError);
      view.setStatus(`❌ Ошибка: ${previewError.message}`, 'error');
      elements.previewBtn.disabled = false;
      elements.exportBtn.disabled = false;
    }
  }

  function openSettings() {
    debugLog('Opening settings page');
    chromeApi.tabs.create({
      url: chromeApi.runtime.getURL('settings.html')
    });
    if (typeof window !== 'undefined' && typeof window.close === 'function') {
      window.close();
    }
  }

  return {
    initializePopup,
    handleExport,
    handlePreview,
    openSettings,
    checkExportAvailability,
    updateDropboxStatus,
    updateGmailStatus
  };
}
