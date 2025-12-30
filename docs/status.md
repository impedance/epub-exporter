<!-- AICODE-NOTE: STATUS/FOCUS ref: docs/status.md -->
<!-- AICODE-NOTE: STATUS/ENTRY ref: README.md -->

# Current Status

## Current Focus
- Keep selection-based workflow documentation aligned with the actual implementation.
- Refresh contributor guidance for developers and agents.
- Validate architecture notes against `manifest.json` and core modules.

## Baseline
- Core extension is implemented; selection-based extraction is the current workflow.
- Test suite exists for content extraction, EPUB generation, and edge cases.

## Next Steps
1. Ensure selection + image-handling docs stay consistent across files.
2. Expand customization examples (tables, captions, edge cases).
3. Update technical context if Chrome Selection APIs change.
4. Monitor EPUB generation performance on very large selections.

## Known Risks
- Large selections can stress service worker memory and image fetching.
- Cross-origin image fetching can still fail despite fallbacks.
- Selection APIs vary slightly across sites, requiring defensive parsing.

## Fast Orientation Commands
- `rg -n "AICODE-" .`
- `rg -n "extractSelectedContent" content_script.js`
- `rg -n "createEPUB" background.js epub_generator.js`
- `rg -n "Dropbox" dropbox_client.js config.js popup.js`
