import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

const popupPath = new URL('../../popup.html', import.meta.url);
const popupHtmlRaw = await readFile(popupPath, 'utf8');
const popupHtml = popupHtmlRaw.replace(/<script.*?>.*?<\/script>/gs, '');

async function loadPopup({
  dropboxConnected = true,
  gmailConnected = true,
  tabUrl = 'https://example.com/article',
  createEPUBResponse = { success: true, downloadUrl: 'data:application/epub+zip;base64,blobdata', filename: 'Sample.epub' }
} = {}) {
  const dom = new JSDOM(popupHtml, {
    url: 'https://extension.test/popup.html',
    pretendToBeVisual: true
  });

  const runtimeSendMessageCalls = [];
  const chromeApi = {
    tabs: {
      query: async () => [{ id: 42, url: tabUrl }],
      create: async () => {}
    },
    runtime: {
      getURL: (path) => `chrome-extension://${path}`,
      sendMessage: async (message) => {
        runtimeSendMessageCalls.push(message);
        return createEPUBResponse;
      }
    },
    downloads: {
      download: async () => {}
    }
  };

  const dropboxClient = { isConnected: async () => dropboxConnected };
  const gmailClient = { isConnected: async () => gmailConnected };
  const extractContentFromTabFn = async () => ({
    success: true,
    data: { title: 'Sample', content: 'Test', images: [], url: tabUrl, timestamp: new Date().toISOString() }
  });
  const extractCleanContentFromTabFn = extractContentFromTabFn;

  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalBlob = global.Blob;
  const originalURL = global.URL;
  global.window = dom.window;
  global.document = dom.window.document;
  global.Blob = dom.window.Blob;
  global.URL = dom.window.URL;
  dom.window.close = () => {
    dom.window.__closed = true;
  };

  const { bootstrapPopup } = await import('../../popup.js');
  bootstrapPopup({
    chromeApi,
    dropboxClient,
    gmailClient,
    documentRef: dom.window.document,
    extractContentFromTabFn,
    extractCleanContentFromTabFn
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  return {
    window: dom.window,
    runtimeSendMessageCalls,
    restore() {
      global.window = originalWindow;
      global.document = originalDocument;
      global.Blob = originalBlob;
      global.URL = originalURL;
    }
  };
}

function waitForStatus(window, matcher) {
  return new Promise((resolve, reject) => {
    const status = window.document.getElementById('status');
    if (matcher(status.innerHTML)) {
      resolve(status.innerHTML);
      return;
    }
    const observer = new window.MutationObserver(() => {
      if (matcher(status.innerHTML)) {
        observer.disconnect();
        resolve(status.innerHTML);
      }
    });
    observer.observe(status, { childList: true, subtree: true, characterData: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Timed out waiting for status update'));
    }, 500);
  });
}

test('regression: export workflow without Dropbox/Kindle still works', async () => {
  const context = await loadPopup({ dropboxConnected: false, gmailConnected: false });
  try {
    const exportBtn = context.window.document.getElementById('exportBtn');
    exportBtn.click();
    await waitForStatus(context.window, (value) => /EPUB файл успешно создан/.test(value));
  } finally {
    context.restore();
  }
});

test('feature: export workflow with Kindle requests background send', async () => {
  const context = await loadPopup({ gmailConnected: true });
  try {
    const sendToKindleBtn = context.window.document.getElementById('sendToKindleBtn');
    sendToKindleBtn.click();
    await waitForStatus(context.window, (value) => /Отправлен на Kindle/.test(value));
    assert.equal(context.runtimeSendMessageCalls.length, 1);
    assert.equal(context.runtimeSendMessageCalls[0].sendToKindle, true);
  } finally {
    context.restore();
  }
});

test('regression: Dropbox status is still correctly initialized', async () => {
  const context = await loadPopup({ dropboxConnected: true });
  try {
    const dropboxStatus = context.window.document.getElementById('dropboxStatus');
    assert.equal(dropboxStatus.textContent, '📁 Dropbox подключен');
  } finally {
    context.restore();
  }
});

test('feature: Gmail status is correctly initialized', async () => {
  const context = await loadPopup({ gmailConnected: true });
  try {
    const kindleStatus = context.window.document.getElementById('kindleStatus');
    assert.equal(kindleStatus.textContent, '📧 Gmail подключен');
  } finally {
    context.restore();
  }
});
