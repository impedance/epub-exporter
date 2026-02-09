import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  loadZipFromFile,
  readZipText,
  validateXhtmlContract
} from '../helpers/epub_contract.mjs';

const badFixtures = [
  new URL('../../sample/__2026-01-30 (4).epub', import.meta.url)
].filter((fixture) => existsSync(fixture));

const goodFixture = new URL('../../sample/pocketbook_control.epub', import.meta.url);
const hasGoodFixture = existsSync(goodFixture);

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

test('control EPUB fixture passes PocketBook XHTML contract checks', async (t) => {
  if (!hasGoodFixture) {
    t.skip('Missing sample/pocketbook_control.epub control fixture');
    return;
  }
  const zip = await loadZipFromFile(goodFixture);
  const xhtml = await readZipText(zip, 'OEBPS/chapter1.xhtml');
  const errors = validateXhtmlContract(xhtml);
  assert.deepEqual(errors, [], 'Expected no contract violations in control EPUB');
});
