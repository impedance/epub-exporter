import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// AICODE-WHY: Ensures extension manifest remains valid JSON after manual edits [2025-08-11]

test('manifest.json is valid JSON', () => {
  const content = fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
  assert.doesNotThrow(() => JSON.parse(content));
});
