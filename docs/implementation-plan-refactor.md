# Implementation Plan: Refactor

This document is the single source of truth for the refactor backlog and PR execution order.

## Quick Orientation
1. Read `readme.md`, `docs/context.md`, `docs/status.md`.
2. Run `rg -n "AICODE-" .` to find anchors.
3. Run baseline checks: `npm run lint:aicode`, `npm test`, `npm run typecheck`.

## Scope
- Refactor for maintainability (smaller modules, clearer boundaries, less duplication).
- Keep behavior stable unless explicitly called out in P0.

## Non-Goals
- Full TypeScript migration (project stays JS + JSDoc + `tsc --noEmit`).
- Any change to PocketBook XHTML contract rules.
- Large UI redesign.
- Redesign of Dropbox/Gmail auth flows.

## Contracts / Risks
- AICODE-CONTRACT: `docs/context.md` selection workflow invariant (must be aligned with behavior in P0).
- AICODE-TRAP: `epub_generator.js` object URL availability in MV3 service workers.
- AICODE-TRAP: CORS/canvas/image fetch fallbacks (`content_script.js`, `background.js`).
- PocketBook XHTML output must remain strict and sanitized (`docs/decisions/ADR-0002-pocketbook-xhtml-contract.md`).

AICODE-NOTE: DECISION/SELECTION-CONTRACT decision: strict selection-only export confirmed on 2026-02-10; clean extraction remains preview-only.

## Affected Entry Points / Files
- P0 alignment: `docs/context.md`, `content_script.js`, `popup.js`, related tests.
- Popup refactor: `popup.html`, `popup.js`, `extractContent.js`, `ui/*`, `test/full/popup.test.mjs`.
- Content refactor: `content_script.js`, `content/*`, `types.d.ts`, content-related `test/*` suites.
- Background refactor: `background.js`, `background/images.js`, `test/full/background_images.test.mjs`.
- EPUB generator cleanup: `epub_generator.js`, `epub/*`, contract tests.

## Priority Backlog

### P0 - Lock the "Selection Only" contract (must do first)
Tasks:
- Align docs and runtime behavior for strict selection-only export.
- Keep clean extraction (Readability) preview-only in UI and extraction paths.
- Update tests that encode selection/export behavior.

Done when:
- Docs and behavior match.
- `npm test` and `npm run typecheck` pass.

### P1 - Popup modularization and coupling cleanup
Tasks:
- Remove accidental/non-working script loads in `popup.html`.
- Unify tab messaging + injection logic (shared helper, no duplication with `extractContent.js`).
- Keep `popup.js` as bootstrap/wiring and move logic to `ui/view.js`, `ui/state.js`, `ui/events.js`.

Done when:
- `popup.js` is mostly composition/wiring.
- No implicit `window.*` coupling unless explicitly documented.
- `test/full/popup.test.mjs` stays green.

### P2 - Split `content_script.js` into focused modules
Tasks:
- Move selection logic to `content/selection.js`.
- Move cleanup/text normalization to `content/cleanup.js`.
- Move image extraction/conversion to `content/images.js`.
- Keep `content_script.js` as message listener + orchestration.

Done when:
- `content_script.js` is substantially smaller and orchestrator-only.
- Selection contract coverage remains green.

### P3 - Keep `EPUBGenerator` orchestration-focused
Tasks:
- Move remaining utility-style helpers out of `epub_generator.js` where coupling decreases.
- Make chapter building and sanitization boundaries explicit.
- Add/adjust tests only for missing contract coverage.

Done when:
- Generator reads as: prepare `BookData` -> build structure -> validate contracts -> generate blob/url.
- Output behavior remains unchanged (contract tests green).

### P4 - Background image prep isolation
Tasks:
- Remove stale/unused background code.
- Keep `background.js` as routing/orchestration layer.
- Isolate image normalization/fetch fallbacks in `background/images.js`.

Done when:
- Background listener is thin and readable.
- Background image tests remain green.

## PR Execution Sequence (small, reversible)

### PR-0: P0 contract alignment
1. Lock docs + UX + extraction behavior to strict selection-only export.
2. Update tests to encode final contract.

Rollback:
- Revert PR; avoid file moves here.

### PR-1: Popup quick wins
1. Fix script/module loading in `popup.html`.
2. Remove dead helpers in `popup.js`.
3. Keep popup tests green.

Rollback:
- Revert PR; no broad module changes yet.

### PR-2: Shared tab messaging helper
1. Extract duplicated send/inject/retry logic into one helper.
2. Switch popup clean-preview path to shared helper.
3. Keep `test/core/extractContent.test.mjs` and popup tests green.

Rollback:
- Revert PR; helper remains isolated.

### PR-3: Popup split to `ui/*`
1. Create `ui/view.js`, `ui/state.js`, `ui/events.js`.
2. Reduce `popup.js` to composition root.
3. Update tests/mocks as needed.

Rollback:
- Revert PR; confined to popup subsystem.

### PR-4: Content split to `content/*`
1. Create `content/selection.js`, `content/cleanup.js`, `content/images.js`.
2. Keep `content_script.js` orchestration-only.
3. Prefer black-box output tests over broad helper unit tests.

Rollback:
- Revert PR; do not mix with popup moves.

### PR-5: Background image prep extraction
1. Keep routing in `background.js`.
2. Move image prep internals to `background/images.js`.
3. Keep background image suite green.

Rollback:
- Revert PR; minimal public surface changes.

### PR-6: Optional `epub_generator.js` cleanup
1. Move remaining utility-like helpers only where it reduces coupling.
2. Preserve output contracts.

Rollback:
- Revert PR.

## Validation Checklist
- Every PR:
  - `npm run lint:aicode`
  - `npm test`
  - `npm run typecheck`
- Before merging module-split PRs (PR-3/PR-4):
  - `npm run test:full`

## Test Strategy Notes
- Keep `test/core/` as black-box contract suite.
- Keep `test/full/` for UI/DOM-heavy and integration-adjacent coverage.
- Avoid fixture rewrites across multiple subsystems in one PR.

## Rollback Strategy
- Keep PRs reversible with `git revert`.
- Avoid "move everything at once"; localize each PR to one subsystem.
