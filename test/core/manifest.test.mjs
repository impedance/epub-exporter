import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// AICODE-NOTE: TEST/MANIFEST decision: keep manifest valid JSON after manual edits.

test('manifest.json is valid JSON', () => {
  const content = fs.readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8');
  assert.doesNotThrow(() => JSON.parse(content));
});
