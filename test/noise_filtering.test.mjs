import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentScriptPath = path.join(__dirname, '../content_script.js');
const contentScript = fs.readFileSync(contentScriptPath, 'utf8');

// Mock DOM environment for content script testing
function createMockDOM(htmlContent = '') {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${htmlContent}</body></html>`, {
        url: 'https://example.com',
        pretendToBeVisual: true
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;

    return dom;
}

// Load content script into JSDOM
function loadContentScript(dom) {
    // Remove Chrome-specific code for testing
    const testableScript = contentScript
        .replace(/chrome\.runtime\.onMessage\.addListener.*?\n}\);/s, '')
        .replace(/\/\* global chrome \*\//, '')
        .replace(/\/\/@ts-check/, '')
        .replace(/\/\*\* @typedef.*?\*\//sg, '');

    dom.window.eval(testableScript);
    return dom.window;
}

test('extractCleanPageContent filters out noise elements (sidebar, nav)', async (t) => {
    const html = `
        <div class="devsite-book-nav-wrapper">
            <nav class="devsite-book-nav">
                <ul>
                    <li><a href="/link1">Sidebar Link 1</a></li>
                    <li><a href="/link2">Sidebar Link 2</a></li>
                </ul>
            </nav>
        </div>
        <main id="main-content">
            <h1>Real Article Title</h1>
            <p>This is the actual content that should be extracted.</p>
        </main>
        <footer>
            <p>Footer noise</p>
        </footer>
    `;

    const dom = createMockDOM(html);
    // Mock Readability since it's not loaded in this test environment easily
    // We'll define a minimal version that works with our test
    global.Readability = class {
        constructor(doc) {
            this.doc = doc;
        }
        parse() {
            // Readability should only see what's left after pre-filtering
            return {
                title: 'Real Article Title',
                content: this.doc.body.innerHTML
            };
        }
    };
    global.DOMPurify = { sanitize: (h) => h };

    const win = loadContentScript(dom);

    const result = await win.extractCleanPageContent();

    // Verify results
    assert.ok(result.content.includes('Real Article Title'), 'Main content should be present');
    assert.ok(result.content.includes('actual content'), 'Main content should be present');
    assert.ok(!result.content.includes('Sidebar Link 1'), 'Sidebar links should be filtered out');
    assert.ok(!result.content.includes('Footer noise'), 'Footer should be filtered out');
    assert.ok(!result.content.includes('devsite-book-nav'), 'Sidebar class should be gone');
});

test('extractTextContentFromElement also filters noise', async (t) => {
    const html = `
        <div id="root">
            <nav class="menu">Menu Link</nav>
            <div class="content">
                <h1>Title</h1>
                <p>Paragraph</p>
                <div class="sidebar">More sidebar noise</div>
            </div>
        </div>
    `;

    const dom = createMockDOM(html);
    const win = loadContentScript(dom);

    const root = dom.window.document.getElementById('root');
    const result = await win.extractTextContentFromElement(root);

    assert.ok(result.includes('<h1>Title</h1>'));
    assert.ok(result.includes('<p>Paragraph</p>'));
    assert.ok(!result.includes('Menu Link'), 'Menu link should be filtered out');
    assert.ok(!result.includes('More sidebar noise'), 'Sidebar noise should be filtered out');
});
