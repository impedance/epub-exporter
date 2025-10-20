import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadContentScript(html) {
  const dom = new JSDOM(html, { url: 'https://example.com' });
  const code = await readFile(new URL('../content_script.js', import.meta.url), 'utf8');

  const sandbox = {
    window: dom.window,
    document: dom.window.document,
    console,
    chrome: { runtime: { onMessage: { addListener: () => {} } } }
  };

  sandbox.window.console = console;
  sandbox.window.chrome = sandbox.chrome;
  sandbox.globalThis = sandbox.window;

  vm.createContext(sandbox);
  try {
    vm.runInContext(code, sandbox);
  } catch (error) {
    console.error('loadContentScript error', error);
    throw error;
  }

  return sandbox;
}

test('extractTitle prefers first heading', async () => {
  const { window } = await loadContentScript(`
    <h2>Secondary</h2>
    <div class="page-title">Ignored</div>
    <h1>Primary Title</h1>
  `);

  assert.equal(window.extractTitle(), 'Primary Title');
});

test('extractSelectedContent converts selection to paragraphs', async () => {
  const { window, document } = await loadContentScript(`
    <article>
      <p id="p1">First paragraph</p>
      <p id="p2">Second paragraph</p>
    </article>
  `);

  const selection = window.getSelection();
  const range = document.createRange();
  const p1 = document.getElementById('p1');
  const p2 = document.getElementById('p2');
  assert.ok(selection, 'window.getSelection should be available');
  const activeSelection = selection;

  range.setStart(p1.firstChild, 0);
  range.setEnd(p2.firstChild, p2.textContent.length);
  activeSelection.removeAllRanges();
  activeSelection.addRange(range);

  const html = await window.extractSelectedContent(activeSelection);
  assert.match(html, /^<p>First paragraph Second paragraph<\/p>$/);
});

test('extractPageContent returns structured payload with timestamp', async () => {
  const { window, document } = await loadContentScript(`
    <main>
      <h1>Sample Title</h1>
      <p id="paragraph">Some highlighted text.</p>
    </main>
  `);

  const selection = window.getSelection();
  const range = document.createRange();
  const paragraph = document.getElementById('paragraph');
  assert.ok(selection, 'window.getSelection should be available');
  const activeSelection = selection;
  range.selectNodeContents(paragraph);
  activeSelection.removeAllRanges();
  activeSelection.addRange(range);

  window.extractImagesFromSelection = async () => [];

  const result = await window.extractPageContent();

  assert.equal(result.title, 'Sample Title');
  assert.ok(result.content.includes('<p>Some highlighted text.</p>'));
  assert.equal(result.url, 'https://example.com/');
  assert.ok(Date.parse(result.timestamp), 'timestamp should be ISO string');
});
