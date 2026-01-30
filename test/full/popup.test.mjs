import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const popupPath = new URL('../../popup.html', import.meta.url);
const popupHtmlRaw = await readFile(popupPath, 'utf8');
const popupHtml = popupHtmlRaw.replace(/<script.*?>.*?<\/script>/gs, '');

async function loadPopup({
  dropboxConnected = true,
  gmailConnected = true,
  tabUrl = 'https://example.com/article',
  extractContentResponse = { success: true, data: { title: 'Sample', content: '<p>Test</p>', images: [], url: tabUrl, timestamp: new Date().toISOString() } },
  createEPUBResponse = { success: true, downloadUrl: 'data:application/epub+zip;base64,', filename: 'Sample.epub' }
} = {}) {
  const dom = new JSDOM(popupHtml, {
    url: 'https://extension.test/popup.html',
    pretendToBeVisual: true
  });

  const script = await readFile(new URL('../../popup.js', import.meta.url), 'utf8');
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

  const chrome = {
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
    },
    storage: {
      local: {
        get: async () => ({})
      }
    }
  };

  const dropboxUploadCalls = [];
  const dropboxClient = {
    isConnected: async () => dropboxConnected,
    uploadFile: async (blob, filename) => {
      dropboxUploadCalls.push({ blob, filename });
      return `/Dropbox/${filename}`;
    }
  };

  const gmailClient = {
    isConnected: async () => gmailConnected,
    sendEmail: async () => ({ id: 'ok' }),
    getAccessToken: async () => 'token'
  };

  const extractCalls = [];
  const extractContentFromTab = async (tabId) => {
    extractCalls.push(tabId);
    return extractContentResponse;
  };

  const sandbox = {
    window: dom.window,
    document: dom.window.document,
    console,
    chrome,
    dropboxClient,
    gmailClient,
    extractContentFromTab,
    fetch: async (url) => ({
      blob: async () => new Blob([`content from ${url}`], { type: 'application/epub+zip' })
    }),
    setTimeout,
    clearTimeout
  };

  sandbox.window.console = console;
  sandbox.window.chrome = chrome;
  sandbox.window.dropboxClient = dropboxClient;
  sandbox.window.gmailClient = gmailClient;
  sandbox.window.extractContentFromTab = extractContentFromTab;
  sandbox.window.fetch = sandbox.fetch;
  sandbox.window.setTimeout = setTimeout;
  sandbox.window.clearTimeout = clearTimeout;
  sandbox.window.close = () => { sandbox.window.__closed = true; };

  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);

  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    window: dom.window,
    chrome,
    dropboxClient,
    downloadsCalls,
    runtimeSendMessageCalls,
    tabsQueryCalls,
    tabsCreateCalls,
    dropboxUploadCalls,
    extractCalls
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
  const { window } = await loadPopup({
    dropboxConnected: true,
    gmailConnected: true
  });

  const dropboxStatus = window.document.getElementById('dropboxStatus');
  const uploadBtn = window.document.getElementById('uploadToDropboxBtn');
  const kindleStatus = window.document.getElementById('kindleStatus');
  const sendToKindleBtn = window.document.getElementById('sendToKindleBtn');
  const exportBtn = window.document.getElementById('exportBtn');

  if (dropboxStatus.textContent !== '📁 Dropbox подключен') {
    throw new Error(`Unexpected dropbox status text: "${dropboxStatus.textContent}"`);
  }
  if (dropboxStatus.className !== 'dropbox-status connected') {
    throw new Error(`Unexpected dropbox status class: "${dropboxStatus.className}"`);
  }
  if (uploadBtn.disabled) {
    throw new Error('Upload button should be enabled');
  }
  if (kindleStatus.textContent !== '📧 Gmail подключен') {
    throw new Error(`Unexpected kindle status text: "${kindleStatus.textContent}"`);
  }
  if (sendToKindleBtn.disabled) {
    throw new Error('Send to Kindle button should be enabled');
  }
  if (exportBtn.disabled) {
    throw new Error('Export button should remain enabled for regular pages');
  }
});

test('handleExport happy path downloads EPUB and shows success message', async () => {
  const context = await loadPopup({
    dropboxConnected: false,
    gmailConnected: false
  });

  const { window, downloadsCalls, runtimeSendMessageCalls, extractCalls } = context;
  const exportBtn = window.document.getElementById('exportBtn');

  exportBtn.click();
  await waitForStatus(window, (value) => /EPUB файл успешно создан/.test(value));

  assert.equal(extractCalls.length, 1, 'content extraction should request active tab');
  assert.equal(runtimeSendMessageCalls.length, 1, 'background should be asked to create EPUB');
  assert.equal(downloadsCalls.length, 1, 'downloads API should receive generated EPUB');
});

test('export button disabled for chrome:// pages', async () => {
  const { window } = await loadPopup({
    tabUrl: 'chrome://settings'
  });

  const exportBtn = window.document.getElementById('exportBtn');
  const status = window.document.getElementById('status');

  assert.equal(exportBtn.disabled, true);
  assert.match(status.textContent, /Экспорт недоступен/i);
});
