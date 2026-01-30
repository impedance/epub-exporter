import test from 'node:test';
import assert from 'node:assert/strict';

// Mock chrome for the background.js import
globalThis.chrome = {
    runtime: {
        onMessage: {
            addListener: () => { }
        }
    }
};

const { optimizeImage } = await import('../../background.js');

test('optimizeImage skips non-image data URLs', async () => {
    const dataUrl = 'data:text/plain;base64,SGVsbG8=';
    const result = await optimizeImage(dataUrl);
    assert.equal(result, dataUrl);
});

test('optimizeImage handles environment where OffscreenCanvas is missing', async () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    delete globalThis.OffscreenCanvas;

    try {
        const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const result = await optimizeImage(dataUrl);
        assert.equal(result, dataUrl, 'Should return original URL if OffscreenCanvas is missing');
    } finally {
        globalThis.OffscreenCanvas = originalOffscreenCanvas;
    }
});
