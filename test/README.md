# EPUB Exporter Tests

This directory contains comprehensive tests for the selection-based EPUB exporter Chrome extension.

## Test Structure

### Core suite (`test/core/`)
- **`extractContent.test.mjs`** - Selection-only extraction flow
- **`manifest.test.mjs`** - Validation for Chrome extension manifest
- **`pocketbook_xhtml_contract.test.mjs`** - XHTML contract on real EPUB fixtures
- **`pocketbook_output_contract.test.mjs`** - End-to-end EPUB output contract (black box)
- **`pocketbook_chapter_split.test.mjs`** - Chapter splitting updates OPF/NCX
- **`epub_generator_helpers.test.mjs`** - Minimal helper coverage (sanitizer + image filtering)

### Full suite (`test/full/`)
- DOM-heavy, UI, and feature-adjacent tests kept for deeper regression checks.
- Run only when needed (longer, more coupled to implementation details).

## Running Tests

```bash
# Run core suite (default)
npm test

# Run full suite (core + full)
npm run test:full

# Run verbose test suite with summary
npm run test:verbose

# Run type checking
npm run typecheck
```

## Test Coverage

The test suite covers:

✅ **Core Coverage**
- Selection-only extraction flow
- XHTML contract enforcement and sanitization outputs
- EPUB packaging contract (zip entries + manifest)
- Chapter splitting / navigation updates
- Manifest JSON validity

## Test Philosophy

Tests prioritize black-box output contracts and a small set of fragile helper checks. Implementation-heavy tests live in the full suite for deeper investigations.

## Dependencies

- **Node.js native test runner** - No external test framework needed
- **jsdom** - For DOM simulation in tests
- **Chrome Extension APIs** - Mocked where necessary

The tests are designed to run in CI/CD environments and provide clear feedback on any regressions.
