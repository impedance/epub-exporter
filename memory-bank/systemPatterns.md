# System Patterns: EPUB Exporter

## Architecture Overview
1. **Browser Extension Components**:
   - Background script (background.js)
   - Content script (content_script.js)
   - Popup UI (popup.html, popup.js)

2. **Core Processing**:
   - Content extraction (extractContent.js)
   - EPUB generation (epub_generator.js)
   - JSZip integration (jszip.min.js)

## Data Flow
1. Content Script extracts article content
2. Content is passed to Background script
3. EPUB Generator processes content into EPUB format
4. JSZip creates final EPUB package
5. User downloads generated EPUB

## Key Patterns
- Content extraction via DOM analysis
- Message passing between extension components
- EPUB file structure generation
- Asynchronous processing flow
