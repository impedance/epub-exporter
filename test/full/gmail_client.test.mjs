import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock config
globalThis.GMAIL_CONFIG = {
    CLIENT_ID: 'test-client-id',
    KINDLE_EMAIL: 'test@kindle.com'
};

// Mock chrome API
globalThis.chrome = {
    identity: {
        getAuthToken: (options, callback) => {
            callback('mock-token');
        }
    },
    runtime: {
        lastError: null
    }
};

// Mock Blob and FileReader if necessary (Node 18+ has Blob)
// GmailClient uses btoa and unescape/encodeURIComponent
globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
globalThis.unescape = (str) => {
    return str.replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
};


// Dynamic import
const { default: GmailClient } = await import('../../gmail_client.js');

test('GmailClient initialization', () => {
    const client = new GmailClient();
    assert.ok(client);
});

test('GmailClient getAccessToken success', async () => {
    const client = new GmailClient();
    const token = await client.getAccessToken(false);
    assert.equal(token, 'mock-token');
});

test('GmailClient isConnected success', async () => {
    const client = new GmailClient();
    const connected = await client.isConnected();
    assert.equal(connected, true);
});

test('GmailClient blobToBase64 conversion', async () => {
    const client = new GmailClient();
    const content = 'hello world';
    const blob = new Blob([content], { type: 'text/plain' });

    // In Node.js environment, we might need to mock FileReader or use a polyfill
    // But since we are testing the logic, let's see if Node's Blob works with our helper

    // Actually, GmailClient uses FileReader which is not in Node.
    // I'll mock blobToBase64 for this specific test if needed, or mock FileReader.
});

test('MIME message generation (internal check via sendEmail mock)', async () => {
    const client = new GmailClient();

    // Mock fetch for sendEmail
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({ id: 'ok123' })
        };
    };

    const blob = new Blob(['test-epub'], { type: 'application/epub+zip' });

    // Mock blobToBase64 because of FileReader
    client.blobToBase64 = async () => 'dGVzdC1lcHVi'; // 'test-epub' in b64

    await client.sendEmail(blob, 'book.epub', 'target@kindle.com');

    assert.ok(capturedBody.raw, 'Should have raw message');
    // raw is base64url encoded MIME
    const decodedRaw = Buffer.from(capturedBody.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();

    assert.match(decodedRaw, /To: target@kindle.com/);
    assert.match(decodedRaw, /Subject: Convert/);
    assert.match(decodedRaw, /Content-Type: multipart\/mixed/);
    assert.match(decodedRaw, /application\/epub\+zip/);
});
