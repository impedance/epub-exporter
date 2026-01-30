# Implementation Plan: Remove Links From EPUB Content

## Quick Orientation
1. Read `readme.md`, `docs/context.md`, `docs/status.md`.
2. Run `rg -n "AICODE-" .` to find anchors.

## Goal
- Strip hyperlink tags from generated EPUB chapter XHTML so PocketBook renders without clickable links, and TOC blocks inside content become plain text.

## Non-Goals
- Changing EPUB manifest/nav files (`toc.ncx`, `content.opf`) beyond existing generation.
- Reworking selection vs Readability extraction behavior.
- Broad HTML5 tag normalization (e.g., `article`/`section`) beyond link removal.

## Contracts / Risks
- Preserve `AICODE-CONTRACT: CONTRACT/SELECTION` (selection-only capture) in `docs/context.md`.
- Preserve PocketBook XHTML contract (ADR-0002) and avoid introducing invalid markup.

## Entry Points / Files
- `epub/sanitize_xhtml.js`
- `test/core/epub_generator_helpers.test.mjs`
- `docs/context.md`

## Step-by-Step Plan
1. Extend `sanitizeXhtml` to unwrap `<a>` tags (remove opening/closing anchor tags while keeping inner content).
2. Track link removals in the sanitize report for visibility.
3. Add/adjust tests to cover anchor stripping behavior.
4. Update project context documentation to note PocketBook as the target device in use.

## Validation Plan
- `npm run lint:aicode`
- `npm run test:core`

## Rollback Plan
- Revert changes in `epub/sanitize_xhtml.js`, `test/core/epub_generator_helpers.test.mjs`, and `docs/context.md`.
