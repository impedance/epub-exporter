# Implementation Plan: Strengthen JS Type Checking (no TS migration)

## Quick Orientation
1. Read `README.md`, `docs/context.md`, `docs/status.md`.
2. Run `rg -n "AICODE-" .` to find anchors.

## Goal
- Increase the usefulness of `@ts-check` without migrating to TypeScript.
- Tighten type contracts around messaging, EPUB generation, and external integrations.

## Non-Goals
- No conversion of `.js` to `.ts`.
- No bundler changes or build pipeline changes.
- No runtime behavior changes beyond type annotations.

## Contracts / Risks
- Preserve `AICODE-CONTRACT: CONTRACT/SELECTION` (selection-only capture).
- Keep MV3 background service worker constraints in mind.
- Avoid introducing non-ASCII identifiers in code.

## Entry Points / Files
- `tsconfig.json` (type-checker strictness)
- `types.d.ts` (central contracts)
- `content_script.js` (extraction payload)
- `extractContent.js` (message payloads)
- `background.js` (createEPUB request/response contracts)
- `popup.js` (UI request/response handling)
- `epub_generator.js` (BookData/ImageInput contracts)
- `dropbox_client.js` (config + upload params)
- `gmail_client.js` (send parameters)
- `config.js` (env config shape)

## Step-by-Step Plan
1. Tighten TS config:
   - Set `noImplicitAny: true`.
   - Consider `noUncheckedIndexedAccess: true` if diagnostics are manageable.
2. Expand `types.d.ts`:
   - Add explicit `CreateEPUBRequest`, `CreateEPUBResponse`, `FetchImageRequest`, `FetchImageResponse`.
   - Add `DropboxConfig`, `GmailConfig` shapes.
3. Add JSDoc typedef imports at the top of entry points:
   - `content_script.js`: `ExtractedContent`, `ExtractedImage` (already present) and ensure all message payloads use them.
   - `extractContent.js`: annotate request/response for `chrome.tabs.sendMessage`.
   - `background.js`: annotate `createEPUBFile` params + return and `chrome.runtime.onMessage` payloads.
   - `popup.js`: annotate request payloads + response typing for `chrome.runtime.sendMessage`.
4. Normalize `epub_generator.js` contracts:
   - Use `@typedef` for `ImageInput` and `BookData` (already present) and ensure all call sites align.
   - Add `@param` typings for utilities that consume raw text (filename, slug, etc.).
5. Integrations:
   - `dropbox_client.js`: annotate `uploadFile`, `ensureUniqueFilename`, `fileExists` with explicit types.
   - `gmail_client.js`: annotate `sendEmail` and config usage.
   - `config.js`: annotate loaders and return shapes.
6. Fix any newly surfaced type errors:
   - Resolve implicit `any` warnings by adding JSDoc, narrowing, or guards.

## Proposed Function Targets (high-value)
- `background.js`: `createEPUBFile`, `prepareImages`, `fetchImageAsDataURL`
- `popup.js`: workflow handlers around `chrome.runtime.sendMessage` and `chrome.downloads.download`
- `extractContent.js`: request/response payloads for content extraction
- `content_script.js`: `extractPageContent`, `extractSelectedContent` return types
- `epub_generator.js`: `createEPUB`, `generateFilename`, `buildSlugFromText`, `extractFirstSentence`
- `dropbox_client.js`: `uploadFile`, `ensureUniqueFilename`, `fileExists`, `getConfig`, `isConfigured`
- `gmail_client.js`: `sendEmail`, config getters
- `config.js`: `loadDropboxConfig`, `loadGmailConfig`

## Validation Plan
- `npm run lint:aicode`
- `npm run typecheck`
- (Optional) `npm run test:core`

## Rollback Plan
- Revert `tsconfig.json` changes.
- Remove new JSDoc typings and typedefs if they cause noise.
