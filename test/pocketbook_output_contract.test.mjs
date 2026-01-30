import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import EPUBGenerator from '../epub_generator.js';
import {
  collectImageRefsFromXhtml,
  collectManifestHrefs,
  listZipImageEntries,
  validateXhtmlContract
} from './helpers/epub_contract.mjs';

const JSZip = globalThis.JSZip;

async function readFixture(path) {
  const fileUrl = new URL(path, import.meta.url);
  return readFile(fileUrl, 'utf-8');
}

test('EPUB output meets PocketBook XHTML contract and image manifest rules', async () => {
  assert.ok(JSZip, 'JSZip should be available via global scope');

  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = undefined;

  try {
    const dirtyHtml = await readFixture('./fixtures/pocketbook_dirty.html');
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAuMB9WcfHhAAAAAASUVORK5CYII=';

    const generator = new EPUBGenerator();
    const { downloadUrl } = await generator.createEPUB(
      'PocketBook Contract Test',
      dirtyHtml,
      [
        {
          src: 'https://example.com/dirty.png',
          originalSrc: 'https://example.com/dirty.png',
          base64: pixel,
          alt: 'dirty'
        },
        {
          src: 'https://example.com/figure.png',
          originalSrc: 'https://example.com/figure.png',
          base64: pixel,
          alt: 'figure'
        }
      ],
      'https://example.com/article'
    );

    const zipBuffer = Buffer.from(downloadUrl.split(',')[1], 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);

    const xhtml = await zip.file('OEBPS/chapter1.xhtml').async('string');
    const opf = await zip.file('OEBPS/content.opf').async('string');

    const errors = validateXhtmlContract(xhtml);
    assert.deepEqual(errors, [], 'Chapter XHTML should pass PocketBook contract checks');

    const imageRefs = collectImageRefsFromXhtml(xhtml);
    const manifestHrefs = collectManifestHrefs(opf);
    const zipImages = new Set(listZipImageEntries(zip));

    for (const ref of imageRefs) {
      assert.ok(ref.startsWith('images/'), `Image ref should be local: ${ref}`);
      assert.ok(zipImages.has(ref), `Missing image in zip: ${ref}`);
      assert.ok(manifestHrefs.has(ref), `Missing image in OPF manifest: ${ref}`);
    }
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }
});
