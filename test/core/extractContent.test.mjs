import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContentFromTab, extractCleanContentFromTab } from '../../extractContent.js';

test('injects content script when missing', async (t) => {
  let call = 0;
  const sendMessage = t.mock.fn(async () => {
    if (call++ === 0) {
      throw new Error('Could not establish connection. Receiving end does not exist.');
    }
    return { success: true };
  });
  const executeScript = t.mock.fn(async () => {});
  global.chrome = { tabs: { sendMessage }, scripting: { executeScript } };

  const result = await extractContentFromTab(123);
  assert.deepEqual(result, { success: true });
  assert.equal(sendMessage.mock.callCount(), 2);
  assert.deepEqual(executeScript.mock.calls[0].arguments[0], {
    target: { tabId: 123 },
    files: [
      'lib/readability.js',
      'lib/dompurify.js',
      'content/cleanup.js',
      'content/selection.js',
      'content/images.js',
      'content_script.js'
    ]
  });
});

test('supports clean extraction action with same inject-on-demand path', async (t) => {
  let call = 0;
  const sendMessage = t.mock.fn(async () => {
    if (call++ === 0) {
      throw new Error('Could not establish connection. Receiving end does not exist.');
    }
    return { success: true, data: { title: 'Clean' } };
  });
  const executeScript = t.mock.fn(async () => {});
  global.chrome = { tabs: { sendMessage }, scripting: { executeScript } };

  const result = await extractCleanContentFromTab(777);
  assert.deepEqual(result, { success: true, data: { title: 'Clean' } });
  assert.equal(sendMessage.mock.callCount(), 2);
  assert.deepEqual(sendMessage.mock.calls[1].arguments[1], { action: 'extractCleanContent' });
});
