# Technical Context: EPUB Exporter

## Core Technologies
- **Browser Extension**: Chrome Extension Manifest v3
- **Content Processing**: JavaScript (ES6+) with Selection API
- **EPUB Generation**: Custom implementation + JSZip 3.10.1
- **Testing**: Node.js native test runner + JSDOM

## Key APIs Used
- **Selection API**: `window.getSelection()` for text capture
- **DOM API**: TreeWalker, Range, DocumentFragment for content processing
- **Canvas API**: For image processing and base64 conversion
- **Chrome Extension APIs**: tabs, runtime, downloads

## Development Setup
- Node.js with ES modules support
- Chrome extension development tools
- JSDOM for DOM testing simulation
- TypeScript for type checking (optional)

## Dependencies
- **Runtime**: jszip.min.js loaded from CDN
- **Development**: jsdom for testing DOM interactions
- **Chrome APIs**: tabs, runtime, downloads, activeTab permissions

## Architecture Patterns
- **Content Script Injection**: Runs in webpage context
- **Message Passing**: Between content script, popup, and background
- **Selection-Based Processing**: Universal compatibility with any webpage
- **Graceful Degradation**: HTML structure → plain text fallback
- **Base64 Image Embedding**: For EPUB compatibility

## Testing Strategy
- **Unit Tests**: Individual function validation
- **Integration Tests**: Workflow validation
- **Edge Case Testing**: Error conditions and boundary cases
- **DOM Simulation**: JSDOM for realistic testing environment

## Constraints
- Must comply with Chrome Web Store policies
- Limited to browser extension capabilities
- EPUB 2.0 specification compliance
- Cross-origin restrictions for image processing
- Performance constraints for large text selections
