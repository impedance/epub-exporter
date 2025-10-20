import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Helper function to create mock DOM environment
function createMockDOM(htmlContent = '') {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${htmlContent}</body></html>`, {
        url: 'https://example.com',
        pretendToBeVisual: true,
        resources: 'usable'
    });

    const canvasProto = dom.window.HTMLCanvasElement?.prototype;
    if (canvasProto) {
        canvasProto.getContext = () => ({
            drawImage: () => {}
        });
        canvasProto.toDataURL = () => 'data:image/png;base64,mocked';
    }

    class MockImage {
        constructor() {
            this.width = 100;
            this.height = 100;
            this.naturalWidth = 100;
            this.naturalHeight = 100;
            this.onload = null;
            this.onerror = null;
            this._src = '';
        }

        set src(value) {
            this._src = value;
            setTimeout(() => {
                if (typeof this.onload === 'function') {
                    this.onload();
                }
            }, 0);
        }

        get src() {
            return this._src;
        }
    }
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
    dom.window.Image = MockImage;
    global.Image = MockImage;
    global.URL = dom.window.URL;
    
    return dom;
}

// Load content script for testing
async function loadContentScript(dom) {
    const fs = await import('fs');
    const path = await import('path');
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const contentScriptPath = path.join(__dirname, '../content_script.js');
    const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
    
    const testableScript = contentScript
        .replace(/chrome\.runtime\.onMessage\.addListener.*?\n}\);/s, '')
        .replace(/\/\* global chrome \*\//, '')
        .replace(/\/\/@ts-check/, '')
        .replace(/\/\*\* @typedef.*?\*\//sg, '');
    
    dom.window.eval(testableScript);
    return dom.window;
}

test('extractPageContent handles null selection', async (t) => {
    const errorMock = t.mock.method(console, 'error', () => {});
    const dom = createMockDOM('<p>Some content</p>');
    dom.window.getSelection = () => null;
    
    await loadContentScript(dom);
    
    await assert.rejects(
        dom.window.extractPageContent(),
        {
            name: 'Error',
            message: 'Пожалуйста, выделите текст на странице для экспорта'
        }
    );
    errorMock.mock.restore();
});

test('extractPageContent handles selection with zero ranges', async (t) => {
    const errorMock = t.mock.method(console, 'error', () => {});
    const dom = createMockDOM('<p>Some content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 0,
        toString: () => 'some text',
        getRangeAt: () => { throw new Error('No ranges'); }
    });
    
    await loadContentScript(dom);
    
    await assert.rejects(
        dom.window.extractPageContent(),
        {
            name: 'Error',
            message: 'Пожалуйста, выделите текст на странице для экспорта'
        }
    );
    errorMock.mock.restore();
});

test('extractPageContent handles whitespace-only selection', async (t) => {
    const errorMock = t.mock.method(console, 'error', () => {});
    const dom = createMockDOM('<p>Some content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 1,
        toString: () => '   \n\t   ',
        getRangeAt: () => {
            const range = dom.window.document.createRange();
            range.cloneContents = () => dom.window.document.createDocumentFragment();
            return range;
        }
    });
    
    await loadContentScript(dom);
    
    await assert.rejects(
        dom.window.extractPageContent(),
        {
            name: 'Error',
            message: 'Пожалуйста, выделите текст на странице для экспорта'
        }
    );
    errorMock.mock.restore();
});

test('extractSelectedContent fallback to plain text when HTML extraction fails', async (t) => {
    const dom = createMockDOM('<p>Test content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 1,
        toString: () => 'Plain text content',
        getRangeAt: () => {
            throw new Error('Range processing failed'); // Force fallback
        }
    });
    
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);
    
    assert.equal(result, '<p>Plain text content</p>');
});

test('extractSelectedContent handles multi-paragraph plain text', async (t) => {
    const dom = createMockDOM('<p>Test content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 1,
        toString: () => 'First paragraph\n\nSecond paragraph\n\nThird paragraph',
        getRangeAt: () => {
            throw new Error('Force fallback to plain text');
        }
    });
    
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);
    
    assert.ok(result.includes('<p>First paragraph</p>'));
    assert.ok(result.includes('<p>Second paragraph</p>'));
    assert.ok(result.includes('<p>Third paragraph</p>'));
});

test('extractSelectedContent returns empty string for empty fallback text', async (t) => {
    const dom = createMockDOM('<p>Test content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 1,
        toString: () => '',
        getRangeAt: () => {
            throw new Error('Force fallback to plain text');
        }
    });
    
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);
    
    assert.equal(result, '');
});

test('extractImagesFromSelection handles errors gracefully', async (t) => {
    const warnMock = t.mock.method(console, 'warn', () => {});
    const dom = createMockDOM('<p>Test content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 1,
        toString: () => 'content',
        getRangeAt: () => {
            throw new Error('Selection processing failed');
        }
    });
    
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const result = await dom.window.extractImagesFromSelection(selection);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 0);
    warnMock.mock.restore();
});

test('processList handles empty list', async (t) => {
    const dom = createMockDOM('<ul></ul>');
    await loadContentScript(dom);
    
    const ul = dom.window.document.querySelector('ul');
    const result = dom.window.processList(ul, 'ul');
    
    assert.equal(result, '');
});

test('processList handles list with empty items', async (t) => {
    const dom = createMockDOM('<ul><li></li><li>   </li><li>Valid item</li></ul>');
    await loadContentScript(dom);
    
    const ul = dom.window.document.querySelector('ul');
    const result = dom.window.processList(ul, 'ul');
    
    assert.ok(result.includes('<li>Valid item</li>'));
    assert.ok(!result.includes('<li></li>'));
});

test('getDirectTextContent extracts only direct text nodes', async (t) => {
    const dom = createMockDOM('<div>Direct text<span>Nested text</span> More direct</div>');
    await loadContentScript(dom);
    
    const div = dom.window.document.querySelector('div');
    const result = dom.window.getDirectTextContent(div);
    
    assert.equal(result, 'Direct text More direct');
});

test('isChildOfProcessedElement correctly identifies nested elements', async (t) => {
    const dom = createMockDOM('<div><p><span>nested</span></p></div>');
    await loadContentScript(dom);
    
    const div = dom.window.document.querySelector('div');
    const span = dom.window.document.querySelector('span');
    const processedElements = new Set([div]);
    
    const result = dom.window.isChildOfProcessedElement(span, processedElements);
    
    assert.equal(result, true);
});

test('processElement handles unsupported element types', async (t) => {
    const dom = createMockDOM('<table><tr><td>content</td></tr></table>');
    await loadContentScript(dom);
    
    const table = dom.window.document.querySelector('table');
    const result = dom.window.processElement(table);
    
    assert.equal(result, '');
});

test('extractPageContent throws error when processed content is empty', async (t) => {
    const errorMock = t.mock.method(console, 'error', () => {});
    const dom = createMockDOM('<p>Test content</p>');
    dom.window.getSelection = () => ({
        rangeCount: 1,
        toString: () => 'content',
        getRangeAt: () => {
            const range = dom.window.document.createRange();
            range.cloneContents = () => dom.window.document.createDocumentFragment();
            return range;
        }
    });
    
    await loadContentScript(dom);
    
    // Mock extractSelectedContent to return empty string
    const originalExtractSelectedContent = dom.window.extractSelectedContent;
    dom.window.extractSelectedContent = async () => '';
    
    await assert.rejects(
        dom.window.extractPageContent(),
        {
            name: 'Error',
            message: 'Выделенный контент пуст'
        }
    );
    
    // Restore original function
    dom.window.extractSelectedContent = originalExtractSelectedContent;
    errorMock.mock.restore();
});
