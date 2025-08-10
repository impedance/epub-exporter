# Technical Context: EPUB Exporter

## Core Technologies
- **Browser Extension**: Chrome Extension Manifest v3
- **Content Processing**: JavaScript (ES6+)
- **EPUB Generation**: Custom implementation + JSZip
- **Testing**: Jest (from package.json)

## Development Setup
- Node.js (package.json indicates Node environment)
- Chrome extension development tools
- Jest for unit testing

## Dependencies
- jszip.min.js: For EPUB file packaging
- Chrome APIs: tabs, runtime, storage

## Constraints
- Must comply with Chrome Web Store policies
- Limited to browser extension capabilities
- EPUB 3.0 specification requirements
- Performance constraints for content processing
