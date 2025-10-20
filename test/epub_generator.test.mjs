import test from 'node:test';
import assert from 'node:assert/strict';
import EPUBGenerator from '../epub_generator.js';

const JSZip = globalThis.JSZip;

test('createEPUB produces well-formed archive with sanitized filename', async () => {
  assert.ok(JSZip, 'JSZip should be available via global scope');

  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = undefined;

  try {
    const generator = new EPUBGenerator();
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAuMB9WcfHhAAAAAASUVORK5CYII=';

    const { downloadUrl, filename } = await generator.createEPUB(
      'My Test Title!',
      '<p>Привет мир</p>',
      [
        {
          src: 'https://example.com/image.png',
          originalSrc: 'https://example.com/image.png',
          base64: pixel,
          alt: 'pixel'
        }
      ],
      'https://example.com/article'
    );

    assert.ok(
      downloadUrl.startsWith('data:application/epub+zip;base64,'),
      'EPUB should be returned as base64 data URL'
    );
    assert.match(
      filename,
      /^My_Test_Title_\d{4}-\d{2}-\d{2}\.epub$/,
      'Filename should be sanitized and timestamped'
    );

    const zipBuffer = Buffer.from(downloadUrl.split(',')[1], 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);

    const mimetype = await zip.file('mimetype').async('string');
    assert.equal(mimetype, 'application/epub+zip', 'mimetype file must be present and uncompressed');

    const content = await zip.folder('OEBPS').file('chapter1.xhtml').async('string');
    assert.ok(content.includes('<p>Привет мир</p>'), 'Main chapter should contain provided HTML content');

    const opf = await zip.folder('OEBPS').file('content.opf').async('string');
    assert.ok(opf.includes('<dc:title>My Test Title</dc:title>'), 'OPF should include sanitized title');
    assert.ok(opf.includes('images/img_1.png'), 'OPF manifest should include processed images');

    const imageEntry = zip.folder('OEBPS/images').file('img_1.png');
    assert.ok(imageEntry, 'Image asset should be embedded into archive');
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }
});
