const test = require('node:test');
const assert = require('node:assert');
const EPUBGenerator = require('../epub_generator');

// AICODE-WHY: Validates EPUBGenerator utility methods to prevent regressions in EPUB creation logic [2025-08-10]

test('sanitizeTitle removes invalid characters and trims', () => {
  const gen = new EPUBGenerator();
  assert.strictEqual(gen.sanitizeTitle(' Hello!/\\ '), 'Hello');
});

test('sanitizeTitle returns default for empty title', () => {
  const gen = new EPUBGenerator();
  assert.strictEqual(gen.sanitizeTitle(''), 'Экспортированная статья');
});

test('sanitizeContent returns default message when content empty', () => {
  const gen = new EPUBGenerator();
  assert.strictEqual(gen.sanitizeContent(''), '<p>Контент не найден.</p>');
});

test('processImages filters out entries without base64 or src', () => {
  const gen = new EPUBGenerator();
  const images = [
    { base64: 'data:image/png;base64,AAA', src: 'a.png' },
    { base64: null, src: 'b.png' },
    { base64: 'data:image/png;base64,BBB', src: null }
  ];
  assert.deepStrictEqual(gen.processImages(images), [
    { base64: 'data:image/png;base64,AAA', src: 'a.png' }
  ]);
});

test('generateFilename creates epub with sanitized title and date', () => {
  const gen = new EPUBGenerator();
  const filename = gen.generateFilename('Title! with *chars*');
  assert.match(filename, /^Title_with_chars_\d{4}-\d{2}-\d{2}\.epub$/);
});

test('getImageExtension detects format from base64 prefix', () => {
  const gen = new EPUBGenerator();
  assert.strictEqual(gen.getImageExtension('data:image/png;base64,'), 'png');
  assert.strictEqual(gen.getImageExtension('data:image/webp;base64,'), 'webp');
  assert.strictEqual(gen.getImageExtension('data:image/unknown;base64,'), 'jpg');
});

test('escapeXML escapes special characters', () => {
  const gen = new EPUBGenerator();
  const input = '<tag attr="value">&\'';
  const expected = '&lt;tag attr=&quot;value&quot;&gt;&amp;&apos;';
  assert.strictEqual(gen.escapeXML(input), expected);
});

test('loadJSZip loads JSZip library from local file', async () => {
  const gen = new EPUBGenerator();
  const JSZip = await gen.loadJSZip();
  assert.equal(typeof JSZip.prototype.file, 'function');
  assert.equal(typeof JSZip.prototype.generateAsync, 'function');
});
