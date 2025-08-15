import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Mock DOM environment for content script testing
function createMockDOM(htmlContent = '') {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${htmlContent}</body></html>`, {
        url: 'https://example.com',
        pretendToBeVisual: true,
        resources: 'usable'
    });
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
    global.Image = dom.window.Image;
    global.URL = dom.window.URL;
    
    return dom;
}

// Mock Selection API
function createMockSelection(text, htmlContent = null) {
    const dom = createMockDOM(htmlContent || `<p>${text}</p>`);
    const selection = {
        rangeCount: text ? 1 : 0,
        toString: () => text,
        getRangeAt: (index) => {
            if (index === 0 && text) {
                const range = dom.window.document.createRange();
                const element = dom.window.document.querySelector('p') || dom.window.document.body;
                range.selectNodeContents(element);
                
                // Mock cloneContents to return the element content
                range.cloneContents = () => {
                    const fragment = dom.window.document.createDocumentFragment();
                    if (htmlContent) {
                        const div = dom.window.document.createElement('div');
                        div.innerHTML = htmlContent;
                        fragment.appendChild(div);
                    } else {
                        const textNode = dom.window.document.createTextNode(text);
                        fragment.appendChild(textNode);
                    }
                    return fragment;
                };
                
                return range;
            }
            throw new Error('Index out of bounds');
        }
    };
    
    dom.window.getSelection = () => selection;
    global.window.getSelection = () => selection;
    
    return { dom, selection };
}

// Import content script functions (we need to load them in the DOM context)
async function loadContentScript(dom) {
    const fs = await import('fs');
    const path = await import('path');
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const contentScriptPath = path.join(__dirname, '../content_script.js');
    const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
    
    // Remove Chrome-specific code for testing and create a testable version
    const testableScript = contentScript
        .replace(/chrome\.runtime\.onMessage\.addListener.*?\n}\);/s, '')
        .replace(/\/\* global chrome \*\//, '')
        .replace(/\/\/@ts-check/, '')
        .replace(/\/\*\* @typedef.*?\*\//sg, ''); // Remove JSDoc typedefs
    
    // Execute the script in the DOM context
    dom.window.eval(testableScript);
    
    // Verify that functions are available
    const requiredFunctions = ['extractPageContent', 'extractSelectedContent', 'extractTitle', 'cleanText'];
    const missingFunctions = requiredFunctions.filter(fn => typeof dom.window[fn] !== 'function');
    
    if (missingFunctions.length > 0) {
        throw new Error(`Missing functions after script load: ${missingFunctions.join(', ')}`);
    }
    
    return dom.window;
}

test('extractSelectedContent processes simple text selection', async (t) => {
    const { dom } = createMockSelection('Hello world! This is a test.');
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);
    
    assert.ok(result.includes('<p>Hello world! This is a test.</p>'));
});

test('extractSelectedContent handles multi-paragraph selection', async (t) => {
    const htmlContent = '<p>First paragraph</p><p>Second paragraph</p>';
    const { dom } = createMockSelection('First paragraph\n\nSecond paragraph', htmlContent);
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);
    
    assert.ok(result.includes('First paragraph'));
    assert.ok(result.includes('Second paragraph'));
});

test('extractSelectedContent preserves HTML structure', async (t) => {
    const htmlContent = '<h1>Title</h1><p>Content with <strong>bold</strong> text</p><ul><li>List item</li></ul>';
    const { dom } = createMockSelection('Title Content with bold text List item', htmlContent);
    await loadContentScript(dom);

    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);

    assert.ok(result.includes('<h1>Title</h1>'));
    assert.ok(result.includes('<p>Content with bold text</p>'));
    assert.ok(result.includes('<ul>'));
    assert.ok(result.includes('<li>List item</li>'));
});

test('extractSelectedContent retains image tags', async (t) => {
    const base64Img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const htmlContent = `<p>Text</p><img src="${base64Img}" width="100" height="100" alt="test">`;
    const { dom } = createMockSelection('Text', htmlContent);
    await loadContentScript(dom);

    const selection = dom.window.getSelection();
    const result = await dom.window.extractSelectedContent(selection);

    assert.ok(result.includes('<img'));
    assert.ok(result.includes(base64Img));
});

test('extractPageContent throws error when no text is selected', async (t) => {
    const { dom } = createMockSelection(''); // Empty selection
    await loadContentScript(dom);
    
    await assert.rejects(
        dom.window.extractPageContent(),
        {
            name: 'Error',
            message: 'Пожалуйста, выделите текст на странице для экспорта'
        }
    );
});

test('extractPageContent returns complete content object', async (t) => {
    const { dom } = createMockSelection('Test content for EPUB export');
    
    // Set document title for testing
    dom.window.document.title = 'Test Page';
    
    await loadContentScript(dom);
    
    const result = await dom.window.extractPageContent();
    
    assert.equal(typeof result, 'object');
    assert.equal(typeof result.title, 'string');
    assert.equal(typeof result.content, 'string');
    assert.equal(Array.isArray(result.images), true);
    assert.equal(typeof result.url, 'string');
    assert.equal(typeof result.timestamp, 'string');
    
    assert.ok(result.content.includes('Test content for EPUB export'));
    assert.equal(result.url, 'https://example.com/');
});

test('extractTitle finds title from various sources', async (t) => {
    const htmlContent = '<h1>Main Title</h1><div class="title">Secondary Title</div>';
    const { dom } = createMockSelection('content', htmlContent);
    
    dom.window.document.title = 'Document Title';
    await loadContentScript(dom);
    
    const title = dom.window.extractTitle();
    
    // Should prefer h1 over document title
    assert.equal(title, 'Main Title');
});

test('extractTitle falls back to document title', async (t) => {
    const { dom } = createMockSelection('content', '<p>No titles here</p>');
    
    dom.window.document.title = 'Fallback Title';
    await loadContentScript(dom);
    
    const title = dom.window.extractTitle();
    
    assert.equal(title, 'Fallback Title');
});

test('extractTitle returns default when no title found', async (t) => {
    const { dom } = createMockSelection('content', '<p>No titles anywhere</p>');
    
    dom.window.document.title = '';
    await loadContentScript(dom);
    
    const title = dom.window.extractTitle();
    
    assert.equal(title, 'Экспортированная статья');
});

test('cleanText removes extra whitespace and special characters', async (t) => {
    const { dom } = createMockSelection('content');
    await loadContentScript(dom);
    
    const cleaned = dom.window.cleanText('  Multiple   spaces\u00A0\u2000\u200B  ');
    assert.equal(cleaned, 'Multiple spaces');
});

test('extractImagesFromSelection handles selection with images', async (t) => {
    const htmlContent = '<p>Text with image</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" width="100" height="100" alt="test">';
    const { dom } = createMockSelection('Text with image', htmlContent);
    await loadContentScript(dom);
    
    const selection = dom.window.getSelection();
    const images = await dom.window.extractImagesFromSelection(selection);
    
    assert.equal(Array.isArray(images), true);
    // Note: Actual image processing may not work in test environment due to canvas limitations
});

test('processElement handles different HTML elements correctly', async (t) => {
    const { dom } = createMockSelection('content');
    await loadContentScript(dom);
    
    // Test heading processing
    const h1 = dom.window.document.createElement('h1');
    h1.textContent = 'Test Heading';
    const h1Result = dom.window.processElement(h1);
    assert.equal(h1Result, '<h1>Test Heading</h1>');
    
    // Test paragraph processing
    const p = dom.window.document.createElement('p');
    p.textContent = 'Test paragraph';
    const pResult = dom.window.processElement(p);
    assert.equal(pResult, '<p>Test paragraph</p>');
    
    // Test blockquote processing
    const blockquote = dom.window.document.createElement('blockquote');
    blockquote.textContent = 'Test quote';
    const quoteResult = dom.window.processElement(blockquote);
    assert.equal(quoteResult, '<blockquote>Test quote</blockquote>');
});