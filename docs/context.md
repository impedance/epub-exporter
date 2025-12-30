<!-- AICODE-NOTE: CONTEXT/BOOT ref: docs/context.md -->
<!-- AICODE-NOTE: CONTEXT/ENTRY ref: README.md -->
<!-- AICODE-CONTRACT: CONTRACT/SELECTION export requires explicit user selection (no auto-extract) [2025-12-29] -->

# Project Context

## Mission
Export user-selected web content into clean EPUB files optimized for PocketBook and similar e-readers.

## Users and UX Goals
- Readers who want offline, distraction-free versions of web articles.
- Simple flow: select content on a page -> click extension -> download EPUB (optional Dropbox copy).
- Preserve readability (headings, lists, quotes, code, images) with safe fallbacks.

## Core Requirements
- Extract selected content from web pages.
- Convert content to valid EPUB packaging with metadata and styling.
- Provide a download flow (optional Dropbox upload).

## Stack Summary
- Chrome Extension (Manifest V3), JavaScript ES modules.
- Content extraction: Selection API + DOM processing.
- EPUB packaging: custom templates + JSZip.
- Tests: Node.js built-in test runner + JSDOM.
- Optional Dropbox upload via `.env` config loaded by `config.js`.

## Architecture Patterns
- Content script extracts selected HTML/text and image metadata.
- Background service worker normalizes images and builds EPUB.
- Popup UI orchestrates user actions and status updates.
- Message passing between popup, content script, and background.

## Invariants (Do Not Break)
- Selection-based extraction is the only supported capture path.
- EPUB output must keep valid structure (mimetype, META-INF, OEBPS).
- Secrets stay out of git; Dropbox config is loaded from `.env` at runtime.

## Constraints
- Chrome Web Store policies and MV3 service worker limits.
- Cross-origin restrictions around image fetching and canvas access.
- EPUB reader compatibility expectations (PocketBook-first).

## Where to Look First
- `manifest.json` (extension wiring, permissions)
- `content_script.js` (selection extraction entry point)
- `background.js` (EPUB generation, image fetching)
- `epub_generator.js` (EPUB structure and templates)
- `popup.js` (UI flow)
