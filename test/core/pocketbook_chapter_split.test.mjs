import test from 'node:test';
import assert from 'node:assert/strict';
import EPUBGenerator from '../../epub_generator.js';

const JSZip = globalThis.JSZip;

test('oversized content is split into multiple chapters with updated OPF/NCX', async () => {
  assert.ok(JSZip, 'JSZip should be available via global scope');

  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = undefined;

  try {
    const blocks = Array.from({ length: 260 }, (_, i) => `<p>Paragraph ${i} ${'x'.repeat(60)}</p>`).join('');
    const generator = new EPUBGenerator();

    const { downloadUrl } = await generator.createEPUB('Split Test', blocks, [], 'https://example.com/article');
    const zipBuffer = Buffer.from(downloadUrl.split(',')[1], 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);

    const chapters = zip.file(/OEBPS\/chapter\d+\.xhtml/);
    assert.ok(chapters.length > 1, 'Should create multiple chapter files');

    const opf = await zip.file('OEBPS/content.opf').async('string');
    assert.ok(opf.includes('chapter2.xhtml'), 'OPF manifest should include chapter2');
    assert.ok(opf.includes('idref="chapter2"'), 'OPF spine should include chapter2');

    const toc = await zip.file('OEBPS/toc.ncx').async('string');
    assert.ok(toc.includes('chapter2.xhtml'), 'TOC should include chapter2');
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }
});
