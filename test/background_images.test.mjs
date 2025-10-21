import test from 'node:test';
import assert from 'node:assert/strict';

test('prepareImages downloads images referenced only in HTML', async () => {
  const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAuMB9WcfHhAAAAAASUVORK5CYII=';
  const pixelBuffer = Buffer.from(pixelBase64, 'base64');

  const arrayBuffer = pixelBuffer.buffer.slice(
    pixelBuffer.byteOffset,
    pixelBuffer.byteOffset + pixelBuffer.byteLength
  );

  const originalFetch = globalThis.fetch;
  const originalBtoa = globalThis.btoa;
  const originalChrome = globalThis.chrome;

  globalThis.chrome = {
    runtime: {
        onMessage: {
            addListener: () => {}
        }
    }
  };

  const { prepareImages } = await import('../background.js');

  globalThis.fetch = async () => ({
    ok: true,
    headers: new Headers({ 'content-type': 'image/png' }),
    async arrayBuffer() {
      return arrayBuffer;
    }
  });

  if (typeof globalThis.btoa !== 'function') {
    globalThis.btoa = (binary) => Buffer.from(binary, 'binary').toString('base64');
  }

  try {
    const html = '<p><img src="//cdn.example.com/photo.png" alt="Sample" width="120" height="80"/></p>';
    const result = await prepareImages([], 'https://example.com/post', html);

    assert.equal(result.length, 1, 'HTML-referenced image should be captured');
    const image = result[0];

    assert.equal(image.originalSrc, '//cdn.example.com/photo.png');
    assert.ok(
      image.src.startsWith('https://cdn.example.com/photo.png'),
      'Resolved src should use page protocol for protocol-relative URLs'
    );
    assert.ok(
      image.base64.startsWith('data:image/png;base64,'),
      'Image data should be embedded as a data URI'
    );
    assert.equal(image.alt, 'Sample');
    assert.equal(image.width, '120');
    assert.equal(image.height, '80');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBtoa) {
      globalThis.btoa = originalBtoa;
    } else {
      delete globalThis.btoa;
    }
    if (typeof originalChrome !== 'undefined') {
      globalThis.chrome = originalChrome;
    } else {
      delete globalThis.chrome;
    }
  }
});
