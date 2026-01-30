# Implementation Plan: 80/20 Test Suite

## Quick Orientation
1. Read `README.md`, `docs/context.md`, `docs/status.md`.
2. Run `rg -n "AICODE-" .` to find anchors.

## Goal
- Reduce test surface to an 80/20 “golden set” that validates critical behavior via black‑box outputs, while keeping a small number of targeted unit tests for fragile helpers.

## Non-Goals
- Rewrite core extraction/generation logic.
- Remove all unit tests (we will keep a minimal subset).
- Add new product features.

## Contracts / Risks
- Preserve `AICODE-CONTRACT: CONTRACT/SELECTION` (selection-only capture).
- Keep EPUB output contract intact (PocketBook-safe XHTML + valid packaging).
- Avoid test coupling to internal implementation details where black‑box is sufficient.

## Entry Points / Files
- `test/` (selected files for removal or consolidation)
- `test/helpers/epub_contract.mjs`
- `test/README.md`
- `docs/status.md` (if focus changes)

## Proposed 80/20 Core Test Set (keep)
1. **PocketBook XHTML contract (fixtures)**
   - Keep: `test/pocketbook_xhtml_contract.test.mjs`
   - Validates strict XHTML + forbidden patterns on real EPUB fixtures.
2. **EPUB output contract (black box)**
   - Keep: `test/pocketbook_output_contract.test.mjs`
   - Validates sanitize + image manifest + zip entries.
3. **Chapter splitting (behavioral)**
   - Keep: `test/pocketbook_chapter_split.test.mjs`
   - Ensures multi-chapter output updates OPF/NCX.
4. **Selection extraction integration**
   - Keep: `extractContent.test.mjs`
   - Ensures selection-only flow remains valid.
5. **Manifest validity**
   - Keep: `test/manifest.test.mjs`
   - Prevents silent packaging errors.

## Proposed Minimal Unit Tests (keep, but trim)
- Consolidate to a single file that covers only fragile helpers:
  - Keep a small subset from `test/epub_generator_helpers.test.mjs`:
    - `sanitizeXhtml` removes triggers + report counts
    - `sanitizeImageInputs` filters invalid inputs
  - Drop or move other helper tests unless they cover known regressions.

## Tests to Remove or Demote (low 80/20 value)
- Candidate removals (or move to a separate “full” suite):
  - `test/epub_templates.test.mjs` (template placeholders are stable; low risk)
  - `test/epub_generator.test.mjs` (overlaps with output contract)
  - `test/content_functions.test.mjs` (redundant vs integration + contract)
  - `test/noise_filtering.test.mjs` (implementation-heavy; low impact on core contract)
  - `test/optimization.test.mjs` (micro-optimizations not core behavior)
  - `test/popup.test.mjs` (UI orchestration; low impact on EPUB correctness)
  - `test/content_script.test.mjs`, `test/selection_edge_cases.test.mjs` (DOM-heavy, expensive; keep only if recent regressions)
  - `test/background_images.test.mjs` (keep only if real regressions around CORS/image fetching)
  - `test/dropbox_client.test.mjs`, `test/gmail_client.test.mjs` (feature-adjacent; low 80/20 value)

## Add / Optimize (golden middle)
1. **Add a single “smoke export” test**
   - Generate EPUB from a small dirty HTML fixture + 1 image and assert:
     - ZIP structure valid
     - XHTML contract passes
     - OPF/NCX include chapter and image
   - If `test/pocketbook_output_contract.test.mjs` already covers this, extend it slightly instead of adding new files.
2. **Add one “large selection” test (performance-lite)**
   - Keep the existing chapter split test as a lightweight proxy for large content.
3. **Trim helper tests**
   - Keep only sanitizer report + image input filtering.

## Implementation Steps
1. Decide which tests to keep vs remove (confirm with team).
2. Consolidate remaining unit tests into `test/epub_generator_helpers.test.mjs` (or a new `test/critical_helpers.test.mjs`).
3. Remove or move non-core tests to an optional suite (e.g., `test/full/`), update `npm test` to run only core set.
4. Update `test/README.md` to document “core” vs “full” suites.
5. Update `docs/status.md` if testing strategy focus changes.

## Validation Plan
- `npm run lint:aicode`
- `npm test` (core suite)
- (Optional) `npm run test:verbose` for full suite if retained

## Rollback Plan
- Restore removed tests from git history.
- Revert `package.json` test script changes if core/full split is not desired.
