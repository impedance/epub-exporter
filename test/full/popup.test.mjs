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
  extractContentResponse = {
    success: true,
    data: { title: 'Sample', content: '<p>Test</p>', images: [], url: tabUrl, timestamp: new Date().toISOString() }
  },
  createEPUBResponse = { success: true, downloadUrl: 'data:application/epub+zip;base64,', filename: 'Sample.epub' }
} = {}) {
  const dom = new JSDOM(popupHtml, {
    url: 'https://extension.test/popup.html',
    pretendToBeVisual: true
  });

  const tabsQueryCalls = [];
  const tabsQuery = async (query) => {
    tabsQueryCalls.push(query);
    return [{ id: 42, url: tabUrl }];
  };

  const runtimeSendMessageCalls = [];
  const runtimeSendMessage = async (message) => {
    runtimeSendMessageCalls.push(message);
    return createEPUBResponse;
  };

  const downloadsCalls = [];
  const downloadsDownload = async (options) => {
    downloadsCalls.push(options);
  };

  const tabsCreateCalls = [];
  const tabsCreate = async (options) => {
    tabsCreateCalls.push(options);
  };

  const chromeApi = {
    tabs: {
      query: tabsQuery,
      create: tabsCreate
    },
    runtime: {
      getURL: (path) => `chrome-extension://${path}`,
      sendMessage: runtimeSendMessage
    },
    downloads: {
      download: downloadsDownload
    }
  };

  const dropboxClient = {
    isConnected: async () => dropboxConnected
  };

  const gmailClient = {
    isConnected: async () => gmailConnected
  };

  const extractCalls = [];
  const cleanExtractCalls = [];
  const extractContentMock = async (tabId) => {
    extractCalls.push(tabId);
    return extractContentResponse;
  };
  const extractCleanContentMock = async (tabId) => {
    cleanExtractCalls.push(tabId);
    return extractContentResponse;
  };

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
    extractContentFromTabFn: extractContentMock,
    extractCleanContentFromTabFn: extractCleanContentMock
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    window: dom.window,
    downloadsCalls,
    runtimeSendMessageCalls,
    tabsQueryCalls,
    tabsCreateCalls,
    extractCalls,
    cleanExtractCalls,
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

test('popup initialization reflects Dropbox and Gmail connection state', async () => {
  const context = await loadPopup({
    dropboxConnected: true,
    gmailConnected: true
  });

  try {
    const { window } = context;
    const dropboxStatus = window.document.getElementById('dropboxStatus');
    const uploadBtn = window.document.getElementById('uploadToDropboxBtn');
    const kindleStatus = window.document.getElementById('kindleStatus');
    const sendToKindleBtn = window.document.getElementById('sendToKindleBtn');
    const exportBtn = window.document.getElementById('exportBtn');

    assert.equal(dropboxStatus.textContent, '📁 Dropbox подключен');
    assert.equal(dropboxStatus.className, 'dropbox-status connected');
    assert.equal(uploadBtn.disabled, false);
    assert.equal(kindleStatus.textContent, '📧 Gmail подключен');
    assert.equal(sendToKindleBtn.disabled, false);
    assert.equal(exportBtn.disabled, false);
  } finally {
    context.restore();
  }
});

test('handleExport happy path downloads EPUB and shows success message', async () => {
  const context = await loadPopup({
    dropboxConnected: false,
    gmailConnected: false
  });

  try {
    const { window, downloadsCalls, runtimeSendMessageCalls, extractCalls } = context;
    const exportBtn = window.document.getElementById('exportBtn');

    exportBtn.click();
    await waitForStatus(window, (value) => /EPUB файл успешно создан/.test(value));

    assert.equal(extractCalls.length, 1, 'content extraction should request active tab');
    assert.equal(runtimeSendMessageCalls.length, 1, 'background should be asked to create EPUB');
    assert.equal(downloadsCalls.length, 1, 'downloads API should receive generated EPUB');
  } finally {
    context.restore();
  }
});

test('export button disabled for chrome:// pages', async () => {
  const context = await loadPopup({
    tabUrl: 'chrome://settings'
  });

  try {
    const { window } = context;
    const exportBtn = window.document.getElementById('exportBtn');
    const status = window.document.getElementById('status');

    assert.equal(exportBtn.disabled, true);
    assert.match(status.textContent, /Экспорт недоступен/i);
  } finally {
    context.restore();
  }
});
