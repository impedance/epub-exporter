// @ts-check
/* global chrome */

import DropboxClient from './dropbox_client.js';
import GmailClient from './gmail_client.js';
import { extractContentFromTab, extractCleanContentFromTab } from './extractContent.js';
import { createPopupView } from './ui/view.js';
import { createPopupHandlers } from './ui/events.js';

/**
 * @param {Document} doc
 */
function getPopupElements(doc) {
  return {
    exportBtn: /** @type {HTMLButtonElement} */ (doc.getElementById('exportBtn')),
    uploadToDropboxBtn: /** @type {HTMLButtonElement} */ (doc.getElementById('uploadToDropboxBtn')),
    sendToKindleBtn: /** @type {HTMLButtonElement} */ (doc.getElementById('sendToKindleBtn')),
    settingsBtn: /** @type {HTMLButtonElement} */ (doc.getElementById('settingsBtn')),
    previewBtn: /** @type {HTMLButtonElement} */ (doc.getElementById('previewBtn')),
    progress: /** @type {HTMLDivElement} */ (doc.getElementById('progress')),
    progressBar: /** @type {HTMLDivElement} */ (doc.getElementById('progressBar')),
    status: /** @type {HTMLDivElement} */ (doc.getElementById('status')),
    dropboxStatus: /** @type {HTMLDivElement} */ (doc.getElementById('dropboxStatus')),
    kindleStatus: /** @type {HTMLDivElement} */ (doc.getElementById('kindleStatus'))
  };
}

/**
 * @param {{
 *   chromeApi?: typeof chrome,
 *   dropboxClient?: DropboxClient,
 *   gmailClient?: GmailClient,
 *   documentRef?: Document,
 *   extractContentFromTabFn?: (tabId: number) => Promise<{success: boolean, data?: any, error?: string}>,
 *   extractCleanContentFromTabFn?: (tabId: number) => Promise<{success: boolean, data?: any, error?: string}>
 * }} [deps]
 */
export function bootstrapPopup(deps = {}) {
  const chromeApi = deps.chromeApi ?? chrome;
  const documentRef = deps.documentRef ?? document;
  const popupElements = getPopupElements(documentRef);
  const dropboxClient = deps.dropboxClient ?? new DropboxClient();
  const gmailClient = deps.gmailClient ?? new GmailClient();

  /**
   * @param {any[]} args
   */
  const debugLog = (...args) => {
    console.log('[popup]', ...args);
  };

  const view = createPopupView(
    {
      status: popupElements.status,
      progress: popupElements.progress,
      progressBar: popupElements.progressBar
    },
    (message, payload) => debugLog(message, payload)
  );

  const handlers = createPopupHandlers({
    chromeApi,
    extractContentFromTab: deps.extractContentFromTabFn ?? extractContentFromTab,
    extractCleanContentFromTab: deps.extractCleanContentFromTabFn ?? extractCleanContentFromTab,
    dropboxClient,
    gmailClient,
    view,
    elements: {
      exportBtn: popupElements.exportBtn,
      uploadToDropboxBtn: popupElements.uploadToDropboxBtn,
      sendToKindleBtn: popupElements.sendToKindleBtn,
      previewBtn: popupElements.previewBtn,
      dropboxStatus: popupElements.dropboxStatus,
      kindleStatus: popupElements.kindleStatus
    },
    debugLog
  });

  popupElements.exportBtn.addEventListener('click', () =>
    handlers.handleExport({ uploadToDropbox: false, sendToKindle: false })
  );
  popupElements.uploadToDropboxBtn.addEventListener('click', () =>
    handlers.handleExport({ uploadToDropbox: true, sendToKindle: false })
  );
  popupElements.sendToKindleBtn.addEventListener('click', () =>
    handlers.handleExport({ uploadToDropbox: false, sendToKindle: true })
  );
  popupElements.previewBtn.addEventListener('click', handlers.handlePreview);
  popupElements.settingsBtn.addEventListener('click', handlers.openSettings);

  debugLog('Popup mounted, starting initialization');
  handlers.initializePopup();

  return { handlers, view };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrapPopup();
  });
}
