# Implementation Plan: PocketBook Compatibility t1-t4

## Quick Orientation
1. Read `README.md`, `docs/context.md`, `docs/status.md`.
2. Run `rg -n "AICODE-" .` to find anchors.

## Goal
- Implement t1–t4 from `docs/pocketbook-compat-plan.md`: define PocketBook-safe XHTML contract, add XHTML contract tests on existing EPUB fixtures, add a minimal XHTML sanitizer in the EPUB pipeline, and add black-box EPUB output contract tests using dirty HTML fixtures.

## Non-Goals
- t5–t9 improvements (advanced sanitizer, chapter splitting, CLI repair tool, refactors).
- Broader HTML cleanup beyond the listed PocketBook triggers.
- Changes to content extraction logic in `content_script.js`.

## Contracts / Risks
- Preserve `AICODE-CONTRACT: CONTRACT/SELECTION` selection-only capture.
- Keep EPUB structure valid (mimetype first, META-INF, OEBPS) and avoid breaking image embedding.
- Avoid introducing DOM-only APIs in the background/service worker runtime.

## Entry Points / Files
- `docs/decisions/ADR-0002-pocketbook-xhtml-contract.md` (new)
- `epub_generator.js`
- `test/helpers/epub_contract.mjs` (new)
- `test/pocketbook_xhtml_contract.test.mjs` (new)
- `test/pocketbook_output_contract.test.mjs` (new)
- `test/fixtures/pocketbook_dirty.html` (new)
- `docs/status.md`

## Step-by-Step Plan
1. Add PocketBook-safe XHTML contract decision doc and anchor it near EPUB generation sanitizer.
2. Implement minimal XHTML sanitizer (picture/source/svg/br/hr/figure/figcaption) in `epub_generator.js` before chapter generation.
3. Add reusable EPUB/XHTML contract validation helper and t2 regression tests over existing EPUB fixtures.
4. Add t4 black-box contract test generating EPUB from dirty HTML fixture and validate chapter XHTML + manifest/image consistency.

## Validation Plan
- `npm run lint:aicode`
- `npm test`

## Rollback Plan
- Revert new tests and sanitizer changes in `epub_generator.js`.
- Remove the new decision doc and fixture files if the contract is no longer desired.
