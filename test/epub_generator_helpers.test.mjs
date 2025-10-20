import test from 'node:test';
import assert from 'node:assert/strict';
import EPUBGenerator from '../epub_generator.js';
import {
  getImageExtension,
  getImageMediaType,
  sanitizeImageInputs,
  decodeBase64Image
} from '../epub/assets.js';

test('image helpers detect extensions and media types', () => {
  const png = getImageExtension('data:image/png;base64,foo');
  const gif = getImageExtension('data:image/gif;base64,bar');
  const webp = getImageExtension('data:image/webp;base64,baz');
  const jpeg = getImageExtension('data:image/jpeg;base64,qux');
  const fallback = getImageExtension('data:image/unknown;base64,noop');

  assert.equal(png, 'png');
  assert.equal(gif, 'gif');
  assert.equal(webp, 'webp');
  assert.equal(jpeg, 'jpeg');
  assert.equal(fallback, 'jpeg', 'Unsupported types should fall back to jpeg');

  assert.equal(getImageMediaType('png'), 'image/png');
  assert.equal(getImageMediaType('gif'), 'image/gif');
  assert.equal(getImageMediaType('webp'), 'image/webp');
  assert.equal(getImageMediaType('jpeg'), 'image/jpeg');
  assert.equal(getImageMediaType('jpg'), 'image/jpeg');
  assert.equal(
    getImageMediaType('heic'),
    'image/jpeg',
    'Unknown extensions should fall back to image/jpeg'
  );
});

test('generateContentOPF escapes metadata and lists image manifest', () => {
  const generator = new EPUBGenerator();
  const bookData = {
    id: 'book-123',
    title: 'My & Book <Title>',
    timestamp: '2024-05-01T00:00:00.000Z'
  };

  const opf = generator.generateContentOPF(bookData, [
    { id: 'img_1', filename: 'cover.png', mediaType: 'image/png' },
    { id: 'img_2', filename: 'photo.jpeg', mediaType: 'image/jpeg' }
  ]);

  assert.match(
    opf,
    /<dc:title>My &amp; Book &lt;Title&gt;<\/dc:title>/,
    'Title should be XML-escaped'
  );
  assert.match(opf, /<item id="img_1" href="images\/cover\.png" media-type="image\/png"\/>/);
  assert.match(opf, /<item id="img_2" href="images\/photo\.jpeg" media-type="image\/jpeg"\/>/);
});

test('generateChapterXHTML rewrites image sources based on manifest entries', () => {
  const generator = new EPUBGenerator();
  const bookData = {
    title: 'Chapter & One',
    content: '<p><img src="https://example.com/assets/image.png" alt="img"/></p>',
    url: 'https://example.com/article'
  };

  const chapter = generator.generateChapterXHTML(bookData, [
    {
      id: 'img_1',
      filename: 'img_1.png',
      mediaType: 'image/png',
      originalSrc: 'https://example.com/assets/image.png',
      resolvedSrc: 'https://example.com/assets/image.png'
    }
  ]);

  assert.match(chapter, /<h1>Chapter &amp; One<\/h1>/, 'Title should be escaped in template');
  assert.match(chapter, /<img src="images\/img_1\.png" alt="" style="max-width: 100%; height: auto;"\/>/);
  assert.ok(
    !chapter.includes('https://example.com/assets/image.png'),
    'Original image reference should be replaced'
  );
});

test('sanitizeImageInputs filters out incomplete image records', () => {
  const validImage = {
    src: 'resolved.png',
    originalSrc: 'original.png',
    base64: 'data:image/png;base64,ZmFrZQ=='
  };
  const missingBase64 = { src: 'resolved.png', originalSrc: 'original.png', base64: '' };
  const missingSrc = { src: '', originalSrc: 'original.png', base64: 'data:image/png;base64,ZmFrZQ==' };

  const sanitized = sanitizeImageInputs([validImage, missingBase64, missingSrc]);
  assert.equal(sanitized.length, 1);
  assert.deepEqual(sanitized[0], validImage);
});

test('decodeBase64Image converts data URIs into Uint8Array payloads', () => {
  const bytes = decodeBase64Image('data:image/png;base64,AAEC');
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes.length, 3);
  assert.equal(bytes[0], 0);
  assert.equal(bytes[1], 1);
  assert.equal(bytes[2], 2);
});
