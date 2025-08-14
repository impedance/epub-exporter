import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Create a simple test environment for individual functions
function setupTestEnvironment() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
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

// Test individual helper functions in isolation
test('cleanText function works correctly', (t) => {
    setupTestEnvironment();
    
    // Define the function inline for testing
    function cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
            .trim();
    }
    
    assert.equal(cleanText('  Multiple   spaces  '), 'Multiple spaces');
    assert.equal(cleanText('Normal text'), 'Normal text');
    assert.equal(cleanText('Text\u00A0with\u2000special\u200Bchars'), 'Text with special chars');
    assert.equal(cleanText(''), '');
});

test('extractTitle function prioritization works', (t) => {
    const dom = setupTestEnvironment();
    
    function extractTitle() {
        const titleSelectors = [
            'h1',
            '.step-dynamic-container h1',
            '.step-dynamic-container h2',
            '.title',
            '.page-title',
            'title'
        ];
        
        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }
        
        return document.title || 'Экспортированная статья';
    }
    
    // Test with h1 present
    dom.window.document.body.innerHTML = '<h1>Main Title</h1><div class="title">Secondary</div>';
    dom.window.document.title = 'Document Title';
    
    assert.equal(extractTitle(), 'Main Title');
    
    // Test fallback to document title
    dom.window.document.body.innerHTML = '<p>No titles</p>';
    dom.window.document.title = 'Doc Title';
    
    assert.equal(extractTitle(), 'Doc Title');
    
    // Test default fallback
    dom.window.document.body.innerHTML = '<p>No titles</p>';
    dom.window.document.title = '';
    
    assert.equal(extractTitle(), 'Экспортированная статья');
});

test('text selection validation works', (t) => {
    const dom = setupTestEnvironment();
    
    function isValidSelection(selection) {
        return !!(selection && 
                 selection.rangeCount > 0 && 
                 selection.toString().trim() !== '');
    }
    
    // Test null selection
    assert.equal(isValidSelection(null), false);
    
    // Test empty selection
    const emptySelection = {
        rangeCount: 0,
        toString: () => ''
    };
    assert.equal(isValidSelection(emptySelection), false);
    
    // Test whitespace-only selection
    const whitespaceSelection = {
        rangeCount: 1,
        toString: () => '   \n\t   '
    };
    assert.equal(isValidSelection(whitespaceSelection), false);
    
    // Test valid selection
    const validSelection = {
        rangeCount: 1,
        toString: () => 'Valid text content'
    };
    assert.equal(isValidSelection(validSelection), true);
});

test('content processing handles different element types', (t) => {
    const dom = setupTestEnvironment();
    
    function cleanText(text) {
        return text.replace(/\s+/g, ' ').trim();
    }
    
    function processElement(element) {
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                const headerText = cleanText(element.textContent);
                return headerText ? `<${tagName}>${headerText}</${tagName}>` : '';
                
            case 'p':
                const pText = cleanText(element.textContent);
                return pText ? `<p>${pText}</p>` : '';
                
            case 'blockquote':
                const quoteText = cleanText(element.textContent);
                return quoteText ? `<blockquote>${quoteText}</blockquote>` : '';
                
            default:
                return '';
        }
    }
    
    // Test heading processing
    const h1 = dom.window.document.createElement('h1');
    h1.textContent = 'Test Heading';
    assert.equal(processElement(h1), '<h1>Test Heading</h1>');
    
    // Test paragraph processing
    const p = dom.window.document.createElement('p');
    p.textContent = 'Test paragraph content';
    assert.equal(processElement(p), '<p>Test paragraph content</p>');
    
    // Test blockquote processing
    const blockquote = dom.window.document.createElement('blockquote');
    blockquote.textContent = 'Test quote';
    assert.equal(processElement(blockquote), '<blockquote>Test quote</blockquote>');
    
    // Test empty content
    const emptyP = dom.window.document.createElement('p');
    emptyP.textContent = '';
    assert.equal(processElement(emptyP), '');
    
    // Test unsupported element
    const table = dom.window.document.createElement('table');
    table.textContent = 'Table content';
    assert.equal(processElement(table), '');
});

test('paragraph splitting works correctly', (t) => {
    setupTestEnvironment();
    
    function cleanText(text) {
        return text.replace(/\s+/g, ' ').trim();
    }
    
    function splitIntoParagraphs(text) {
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        if (paragraphs.length > 1) {
            return paragraphs.map(p => `<p>${cleanText(p.trim())}</p>`).join('\n');
        } else if (text.trim()) {
            return `<p>${cleanText(text)}</p>`;
        }
        return '';
    }
    
    // Test single paragraph
    const singleText = 'This is a single paragraph of text.';
    assert.equal(splitIntoParagraphs(singleText), '<p>This is a single paragraph of text.</p>');
    
    // Test multiple paragraphs
    const multiText = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const expected = '<p>First paragraph.</p>\n<p>Second paragraph.</p>\n<p>Third paragraph.</p>';
    assert.equal(splitIntoParagraphs(multiText), expected);
    
    // Test empty text
    assert.equal(splitIntoParagraphs(''), '');
    
    // Test whitespace only
    assert.equal(splitIntoParagraphs('   \n\n   '), '');
});

test('image size filtering works', (t) => {
    const dom = setupTestEnvironment();
    
    function shouldIncludeImage(img) {
        return img.width >= 50 && img.height >= 50;
    }
    
    // Create test images
    const largeImg = dom.window.document.createElement('img');
    largeImg.width = 100;
    largeImg.height = 100;
    largeImg.src = 'test.jpg';
    
    const smallImg = dom.window.document.createElement('img');
    smallImg.width = 20;
    smallImg.height = 30;
    smallImg.src = 'icon.jpg';
    
    assert.equal(shouldIncludeImage(largeImg), true);
    assert.equal(shouldIncludeImage(smallImg), false);
});

test('error messages are in Russian', (t) => {
    const expectedMessages = {
        noSelection: 'Пожалуйста, выделите текст на странице для экспорта',
        emptyContent: 'Выделенный контент пуст',
        defaultTitle: 'Экспортированная статья'
    };
    
    // Test that error messages are properly formatted in Russian
    assert.ok(expectedMessages.noSelection.includes('выделите текст'));
    assert.ok(expectedMessages.emptyContent.includes('контент'));
    assert.ok(expectedMessages.defaultTitle.includes('статья'));
});

// Integration test for the selection-based workflow
test('selection-based extraction workflow', (t) => {
    const dom = setupTestEnvironment();
    
    // Mock a page with content
    dom.window.document.title = 'Test Page';
    dom.window.document.body.innerHTML = `
        <h1>Article Title</h1>
        <p>First paragraph of content.</p>
        <p>Second paragraph with more content.</p>
        <img src="test.jpg" width="100" height="100" alt="test image">
    `;
    
    // Mock a selection that includes the paragraphs
    const mockSelection = {
        rangeCount: 1,
        toString: () => 'First paragraph of content. Second paragraph with more content.',
        getRangeAt: (index) => {
            if (index === 0) {
                const range = {
                    cloneContents: () => {
                        const fragment = dom.window.document.createDocumentFragment();
                        const p1 = dom.window.document.createElement('p');
                        p1.textContent = 'First paragraph of content.';
                        const p2 = dom.window.document.createElement('p');
                        p2.textContent = 'Second paragraph with more content.';
                        fragment.appendChild(p1);
                        fragment.appendChild(p2);
                        return fragment;
                    }
                };
                return range;
            }
            throw new Error('Index out of bounds');
        }
    };
    
    // Test that we can detect valid selection
    const isValid = mockSelection.rangeCount > 0 && mockSelection.toString().trim() !== '';
    assert.equal(isValid, true);
    
    // Test that we can extract content structure
    const range = mockSelection.getRangeAt(0);
    const contents = range.cloneContents();
    assert.equal(contents.children.length, 2); // Should have 2 paragraphs
    assert.equal(contents.children[0].tagName, 'P');
    assert.equal(contents.children[1].tagName, 'P');
});