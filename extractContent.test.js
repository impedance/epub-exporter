const test = require('node:test');
const assert = require('node:assert/strict');
const { extractContentFromTab } = require('./extractContent');

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
  assert.deepEqual(executeScript.mock.calls[0].arguments[0], { target: { tabId: 123 }, files: ['content_script.js'] });
});
