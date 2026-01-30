import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadZipFromFile,
  readZipText,
  validateXhtmlContract
} from './helpers/epub_contract.mjs';

const badFixtures = [
  new URL('../_2__2026-01-30.epub', import.meta.url),
  new URL('../Everyone_should_be_using_Claude_Code_more_2026-01-22 (1).epub', import.meta.url),
  new URL('../MCP_Tool_Registry_RAG_2026-01-22 (2).epub', import.meta.url)
];

const goodFixture = new URL('../sample/_red_mad_robot__2026-01-30.epub', import.meta.url);

test('problem EPUB fixtures fail PocketBook XHTML contract checks', async () => {
  for (const fixture of badFixtures) {
    const zip = await loadZipFromFile(fixture);
    const xhtml = await readZipText(zip, 'OEBPS/chapter1.xhtml');
    const errors = validateXhtmlContract(xhtml);
    assert.ok(
      errors.length > 0,
      `Expected contract violations for ${fixture.pathname}`
    );
  }
});

test('control EPUB fixture passes PocketBook XHTML contract checks', async () => {
  const zip = await loadZipFromFile(goodFixture);
  const xhtml = await readZipText(zip, 'OEBPS/chapter1.xhtml');
  const errors = validateXhtmlContract(xhtml);
  assert.deepEqual(errors, [], 'Expected no contract violations in control EPUB');
});
