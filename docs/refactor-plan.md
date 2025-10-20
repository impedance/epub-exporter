# Refactor Plan (EPUB Exporter)

## epub_generator.js
- _Goal_: isolate EPUB templating, asset handling, and orchestration for clarity and reuse.
- Extract XML/CSS template strings into `epub/templates/*.js`; expose simple getters.
- Move image/media helpers (`getImageExtension`, `getImageMediaType`, base64 sanitation) into `epub/assets.js`.
- Keep `EPUBGenerator` focused on `createEPUB`, `buildEPUBStructure`, and validations; import helpers from the new modules.
- Update all imports (`background.js`, tests) to reference the refactored structure.
- Extend coverage with unit tests for template renderers and asset helpers alongside the existing integration test.

## content_script.js
- _Goal_: separate selection logic, HTML cleanup, and media extraction to simplify maintenance.
- Create `content/selection.js` for range cloning, direct text extraction, and processed-element checks.
- Create `content/cleanup.js` for `cleanText`, list processing, and normalization utilities.
- Create `content/images.js` for selection image traversal and base64 conversion.
- Update the content script entry to orchestrate these modules with clear data flow.
- Refresh typedefs in `types.d.ts` and broaden tests to cover new helper exports directly.

## popup.js
- _Goal_: decouple UI rendering, state management, and async workflows for easier UI evolution.
- Introduce `ui/state.js` to wrap Chrome storage + Dropbox connectivity checks.
- Introduce `ui/view.js` for DOM queries, rendering helpers, and progress/status updates.
- Introduce `ui/events.js` to wire user interactions and orchestrate export steps using injected dependencies.
- Slim `popup.js` to bootstrap modules and register handlers.
- Adapt existing popup tests to mock the new modules and keep the happy path + guard clauses covered.

## Test Coverage Roadmap (excluding `dropbox_client.js`)

- **Map gaps**
  - `extractContent.js`: list untested branches (empty selection, malformed markup, list normalization) and cross-check existing fixtures.
  - `popup.js` / `popup.html`: enumerate event handlers and async flows (storage sync, export button, status rendering) missing from tests.
  - `background.js`: inspect command listeners and messaging paths untouched by current integration tests.
  - `epub_generator.js`: confirm helper coverage; note remaining fallback branches (e.g., `URL.createObjectURL` path, image decode failures).

- **Design additions**
  - `extractContent.js`: add cases for empty body, nested OL/UL mixes, images without base64, malformed HTML cleanup and assert sanitized output.
  - `content_script.js`: expand jsdom tests to drive new helper modules covering collapsed ranges and filtered nodes.
  - `popup.js`: create jsdom harness mounting `popup.html`, stubbing Chrome APIs, and verifying UI updates through export success/error flows.
  - `background.js`: mock Chrome messaging/JSZip to exercise listeners for `createEPUBFile`, settings sync, and error handling.
  - `epub_generator.js`: add targeted tests for fallback branches (URL.createObjectURL present, decode failures triggering warnings).

- **Implementation order & prep**
  1. Start with `extractContent.js`; introduce fixtures under `test/fixtures/` as needed.
  2. Extend `content_script` suite to cover helper modules via existing jsdom setup.
  3. Add `popup` UI smoke tests that assert rendering and messaging.
  4. Cover `background.js` messaging and error paths last.
  - Provide shared Chrome mocks in `test/utils/chromeMocks.mjs`.
  - Track remaining work with focused AICODE-TODO tags near the relevant modules.
