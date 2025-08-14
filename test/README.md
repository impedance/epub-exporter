# EPUB Exporter Tests

This directory contains comprehensive tests for the selection-based EPUB exporter Chrome extension.

## Test Structure

- **`content_functions.test.mjs`** - Tests for individual content extraction functions
- **`epub_generator.test.mjs`** - Tests for EPUB generation utilities  
- **`manifest.test.mjs`** - Validation for Chrome extension manifest
- **`content_script.test.mjs`** - Integration tests (currently disabled due to DOM complexity)
- **`selection_edge_cases.test.mjs`** - Edge case tests (currently disabled due to DOM complexity)

## Running Tests

```bash
# Run all tests
npm test

# Run verbose test suite with summary
npm run test:verbose

# Run only core function tests
npm run test:functions

# Run type checking
npm run typecheck
```

## Test Coverage

The test suite covers:

✅ **Text Selection Validation**
- Null/empty selection handling
- Whitespace-only selections
- Valid text selection detection

✅ **Content Processing**
- HTML element processing (h1-h6, p, blockquote, etc.)
- Text cleaning and normalization  
- Multi-paragraph text splitting
- Image size filtering

✅ **Title Extraction**
- Priority-based title selection
- Fallback to document title
- Default title when none found

✅ **Error Handling**
- Russian error messages
- Empty content validation
- Graceful failure modes

✅ **EPUB Generation**
- File structure creation
- Content sanitization
- Image processing
- Filename generation

## Test Philosophy

Tests are written to validate the core functionality that changed when migrating from container-based extraction (`.step-dynamic-container`) to selection-based extraction. The focus is on:

1. **Behavioral validation** - Ensuring functions work correctly with different inputs
2. **Error boundary testing** - Validating proper error handling
3. **Edge case coverage** - Testing unusual but possible scenarios
4. **Integration validation** - Ensuring components work together

## Dependencies

- **Node.js native test runner** - No external test framework needed
- **jsdom** - For DOM simulation in tests
- **Chrome Extension APIs** - Mocked where necessary

The tests are designed to run in CI/CD environments and provide clear feedback on any regressions.