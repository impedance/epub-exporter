import { test } from 'node:test';
import assert from 'node:assert/strict';

// Provide global config before importing client
const DROPBOX_CONFIG = {
    APP_KEY: 'your_dropbox_app_key_here',
    APP_SECRET: 'your_dropbox_app_secret_here',
    REFRESH_TOKEN: 'your_dropbox_refresh_token_here',
    TARGET_FOLDER: '/Apps/EPUB Exporter'
};

// Set global variable expected by dropbox_client.js
globalThis.DROPBOX_CONFIG = DROPBOX_CONFIG;

// Dynamic import after setting globals
const { default: DropboxClient } = await import('../dropbox_client.js');

test('isConnected should exist and return boolean', async (t) => {
    const client = new DropboxClient();
    assert.equal(typeof client.isConnected, 'function');
    const connected = await client.isConnected();
    assert.equal(connected, false);
});
