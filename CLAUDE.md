# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that exports web page content to EPUB format, specifically optimized for PocketBook e-readers. The extension extracts content from user text selections on any webpage, processes text and images, and generates a valid EPUB file for download.

## Architecture

The extension follows a standard Chrome Extension architecture with these components:

### Core Files
- **manifest.json**: Extension configuration (Manifest V3)
- **popup.html/popup.js**: User interface with export button and progress indicator
- **content_script.js**: Runs on web pages to extract content from user text selections
- **background.js**: Service worker that handles EPUB generation using JSZip library
- **epub_generator.js**: Referenced in manifest but not used in current implementation

### Key Workflows

1. **Content Extraction** (`content_script.js`):
   - Uses `window.getSelection()` to capture user-highlighted text
   - Extracts title from various heading selectors (h1, .title, .page-title, document.title)
   - Processes selected content preserving HTML structure (p, h1-h6, li, blockquote, pre, code)
   - Converts images within selection to base64 format
   - Handles both structured HTML and plain text selections

2. **EPUB Generation** (`background.js`):
   - Loads JSZip library from CDN (`https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`)
   - Creates valid EPUB structure with META-INF, OEBPS folders
   - Generates required EPUB files: mimetype, container.xml, content.opf, toc.ncx, chapter1.xhtml, styles.css
   - Embeds images and updates references
   - Triggers download via Chrome downloads API

3. **User Interface** (`popup.js`):
   - Handles export button clicks
   - Shows progress indicator during processing
   - Communicates between content script and background script
   - Provides error handling and status updates

## Development Commands

This is a Chrome extension with Node.js testing capabilities. Development workflow:

```bash
# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select the project directory

# Run tests
npm test                # Run all tests
npm run test:verbose    # Run with detailed reporting
npm run test:functions  # Run core function tests only
npm run typecheck       # Run TypeScript type checking

# Create distributable package
zip -r epub-exporter.zip manifest.json popup.html popup.js content_script.js background.js epub_generator.js

# Debug
# - Use Chrome DevTools for popup.js debugging
# - Use content script debugging in page context
# - Use background script debugging in service worker context
```

## Key Technical Details

### Content Targeting
- Primary method: User text selection via `window.getSelection()`
- Works on any webpage - no specific container requirements
- Title extraction selectors: h1, .title, .page-title, document.title
- Supported content elements: p, h1-h6, li, blockquote, pre, code
- Image size filter: minimum 50x50 pixels
- Fallback: Converts plain text selections to structured HTML paragraphs

### EPUB Generation
- Uses JSZip 3.10.1 loaded dynamically from CDN
- Creates fully compliant EPUB 2.0 format
- CSS optimized for PocketBook e-readers
- Images converted to JPEG base64 with 0.8 quality
- Automatic filename generation with timestamp

### Extension Permissions
- `activeTab`: Access to current tab content
- `downloads`: File download capability
- Runs on `<all_urls>` via content script

### Error Handling
- Validates that text is actually selected before processing
- Provides Russian error messages: "Пожалуйста, выделите текст на странице для экспорта"
- Handles image loading failures gracefully
- Graceful fallback from HTML structure extraction to plain text processing
- Blocks execution on system pages (chrome://)

## Customization Points

The extension now works universally with any website through text selection. Key customization areas:

To adjust EPUB styling, modify the `createCSS()` function in `background.js:202`.

To change content extraction logic, update `extractSelectedContent()` in `content_script.js:91`.

To modify title extraction priority, update the `titleSelectors` array in `extractTitle()` function at `content_script.js:66`.

## Testing

The project includes comprehensive tests covering:
- Text selection validation and processing
- HTML structure preservation
- Error handling and edge cases
- EPUB generation functionality
- Image processing and filtering

See `test/README.md` for detailed testing information.