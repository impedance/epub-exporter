import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const popupPath = new URL('../../popup.html', import.meta.url);
const popupHtmlRaw = await readFile(popupPath, 'utf8');

// Очищаем HTML от скриптов для ручной загрузки в VM
const popupHtml = popupHtmlRaw.replace(/<script.*?>.*?<\/script>/gs, '');

async function loadPopup({
    dropboxConnected = true,
    gmailConnected = true,
    autoUploadDropbox = false,
    autoSendKindle = false,
    tabUrl = 'https://example.com/article',
    createEPUBResponse = { success: true, downloadUrl: 'data:application/epub+zip;base64,blobdata', filename: 'Sample.epub' }
} = {}) {
    const dom = new JSDOM(popupHtml, {
        url: 'https://extension.test/popup.html',
        pretendToBeVisual: true
    });

    const script = await readFile(new URL('../../popup.js', import.meta.url), 'utf8');

    const tabsQuery = async () => [{ id: 42, url: tabUrl }];
    const runtimeSendMessageCalls = [];
    const runtimeSendMessage = async (message) => {
        runtimeSendMessageCalls.push(message);
        return createEPUBResponse;
    };
    const downloadsCalls = [];
    const downloadsDownload = async (options) => {
        downloadsCalls.push(options);
    };

    const storage = {
        autoUploadToDropbox: autoUploadDropbox,
        autoSendToKindle: autoSendKindle
    };

    const chrome = {
        tabs: { query: tabsQuery, create: async () => { } },
        runtime: {
            getURL: (path) => `chrome-extension://${path}`,
            sendMessage: runtimeSendMessage
        },
        downloads: { download: downloadsDownload },
        storage: {
            local: {
                get: async (keys) => {
                    const result = {};
                    if (Array.isArray(keys)) {
                        keys.forEach(k => result[k] = storage[k]);
                    }
                    return result;
                },
                set: async (val) => Object.assign(storage, val)
            }
        }
    };

    const dropboxClient = {
        isConnected: async () => dropboxConnected,
        uploadFile: async () => '/Dropbox/Sample.epub'
    };

    const gmailSendCalls = [];
    const gmailClient = {
        isConnected: async () => gmailConnected,
        sendEmail: async (blob, filename) => {
            gmailSendCalls.push({ filename });
            return { id: 'msg123' };
        },
        getAccessToken: async () => 'token123'
    };

    const extractContentFromTab = async () => ({
        success: true,
        data: { title: 'Sample', content: 'Test', images: [], url: tabUrl, timestamp: new Date().toISOString() }
    });

    const sandbox = {
        window: dom.window,
        document: dom.window.document,
        console,
        chrome,
        dropboxClient,
        gmailClient, // This might be accessed as window.gmailClient
        extractContentFromTab,
        fetch: async () => ({
            blob: async () => new Blob(['epub-content'], { type: 'application/epub+zip' })
        }),
        setTimeout,
        clearTimeout,
        Promise,
        URL: dom.window.URL
    };

    sandbox.window.chrome = chrome;
    sandbox.window.dropboxClient = dropboxClient;
    sandbox.window.gmailClient = gmailClient;
    sandbox.window.extractContentFromTab = extractContentFromTab;
    sandbox.window.fetch = sandbox.fetch;
    sandbox.window.setTimeout = setTimeout;
    sandbox.window.close = () => { sandbox.window.__closed = true; };

    vm.createContext(sandbox);
    vm.runInContext(script, sandbox);

    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
        window: dom.window,
        chrome,
        gmailSendCalls,
        downloadsCalls,
        runtimeSendMessageCalls,
        storage
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
    const { window, downloadsCalls } = await loadPopup({ dropboxConnected: false, gmailConnected: false });
    const exportBtn = window.document.getElementById('exportBtn');

    exportBtn.click();
    await waitForStatus(window, (value) => /EPUB файл успешно создан/.test(value));

    assert.ok(downloadsCalls.length === 1, 'download should be triggered');
});

test('feature: export workflow with Kindle requests background send', async () => {
    const { window, runtimeSendMessageCalls } = await loadPopup({ gmailConnected: true });
    const sendToKindleBtn = window.document.getElementById('sendToKindleBtn');

    sendToKindleBtn.click();

    await waitForStatus(window, (value) => /Отправлен на Kindle/.test(value));

    assert.equal(runtimeSendMessageCalls.length, 1, 'Background should be asked to create EPUB');
    assert.equal(runtimeSendMessageCalls[0].sendToKindle, true);
});

test('regression: Dropbox status is still correctly initialized', async () => {
    const { window } = await loadPopup({ dropboxConnected: true });
    const dropboxStatus = window.document.getElementById('dropboxStatus');
    assert.equal(dropboxStatus.textContent, '📁 Dropbox подключен');
});

test('feature: Gmail status is correctly initialized', async () => {
    const { window } = await loadPopup({ gmailConnected: true });
    const kindleStatus = window.document.getElementById('kindleStatus');
    assert.equal(kindleStatus.textContent, '📧 Gmail подключен');
});
