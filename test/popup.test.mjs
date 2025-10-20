import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const popupHtml = `
  <div>
    <button id="exportBtn">Экспорт в EPUB</button>
    <button id="settingsBtn">Настройки</button>
    <div class="dropbox-section">
      <input type="checkbox" id="uploadToDropbox">
      <div id="dropboxStatus"></div>
    </div>
    <div id="progress"><div id="progressBar"></div></div>
    <div id="status"></div>
  </div>
`;

async function loadPopup({
  dropboxConnected = true,
  autoUpload = false,
  tabUrl = 'https://example.com/article',
  extractContentResponse = { success: true, data: { title: 'Sample', content: '<p>Test</p>', images: [], url: tabUrl, timestamp: new Date().toISOString() } },
  createEPUBResponse = { success: true, downloadUrl: 'data:application/epub+zip;base64,', filename: 'Sample.epub' }
} = {}) {
  const dom = new JSDOM(`<body>${popupHtml}</body>`, {
    url: 'https://extension.test/popup.html',
    pretendToBeVisual: true
  });

  const script = await readFile(new URL('../popup.js', import.meta.url), 'utf8');
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

  const storageGetCalls = [];
  const storageGet = async (keys) => {
    storageGetCalls.push(keys);
    return { autoUploadToDropbox: autoUpload };
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
        get: storageGet
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
    storageGetCalls,
    dropboxUploadCalls,
    extractCalls
  };
}

test('popup initialization reflects Dropbox connection and saved settings', async () => {
  const { window, storageGetCalls } = await loadPopup({
    dropboxConnected: true,
    autoUpload: true
  });

  const dropboxStatus = window.document.getElementById('dropboxStatus');
  const uploadCheckbox = window.document.getElementById('uploadToDropbox');
  const exportBtn = window.document.getElementById('exportBtn');

  if (dropboxStatus.textContent !== '📁 Dropbox подключен') {
    throw new Error(`Unexpected dropbox status text: "${dropboxStatus.textContent}"`);
  }
  if (dropboxStatus.className !== 'dropbox-status connected') {
    throw new Error(`Unexpected dropbox status class: "${dropboxStatus.className}"`);
  }
  if (uploadCheckbox.disabled) {
    throw new Error('Upload checkbox should be enabled');
  }
  if (!uploadCheckbox.checked) {
    throw new Error('Upload checkbox should be checked when autoUpload setting is true');
  }
  if (exportBtn.disabled) {
    throw new Error('Export button should remain enabled for regular pages');
  }
  if (JSON.stringify(storageGetCalls) !== JSON.stringify([['autoUploadToDropbox']])) {
    throw new Error(`Unexpected storage keys: ${JSON.stringify(storageGetCalls)}`);
  }
});

test('handleExport happy path downloads EPUB and shows success message', async () => {
  const context = await loadPopup({
    dropboxConnected: false,
    autoUpload: false
  });

  const { window, downloadsCalls, runtimeSendMessageCalls, extractCalls } = context;
  const exportBtn = window.document.getElementById('exportBtn');

  exportBtn.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(extractCalls.length, 1, 'content extraction should request active tab');
  assert.equal(runtimeSendMessageCalls.length, 1, 'background should be asked to create EPUB');
  assert.equal(downloadsCalls.length, 1, 'downloads API should receive generated EPUB');
  assert.equal(
    window.document.getElementById('status').textContent,
    '✅ EPUB файл успешно создан!'
  );
  assert.equal(window.document.getElementById('exportBtn').disabled, true, 'button stays disabled until timeout');
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
