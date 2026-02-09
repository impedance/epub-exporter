# Report: Sample EPUB Validity Checks (Why Some Readers Refuse to Open)

Date: 2026-01-30

## Scope
Checked these sample EPUBs:
- `sample/mozhno-li-rabotat.epub` (reported: does not open)
- `sample/algos.epub` (reported: opens)
- `sample/mcp-server-dlya.epub` (reported: opens)
- `sample/everyone-should-be.epub` (reported: opens)

The focus is "hard fail / won't open" failure modes (PocketBook/strict EPUB2 renderers).

## High-Level Findings
1. All checked files are structurally valid ZIP archives:
   - `unzip -t` passes for all files.
   - `mimetype` exists, is first, and stored (not deflated).
2. The primary "won't open" root cause observed is *not ZIP packaging*.
3. The hard failure mode is *invalid XHTML-as-XML* in EPUB2 chapters:
   - `OEBPS/chapter1.xhtml` contains the named HTML entity `&nbsp;`.
   - Strict XML parsers reject it with: `undefined entity &nbsp;`.
   - Replacing `&nbsp;` with `&#160;` makes these chapters parse as strict XML.

## Detailed Results Per File

### `sample/algos.epub`
Packaging / structure:
- Has `mimetype`, `META-INF/container.xml`, and OPF at `GoogleDoc/package.opf`.
- EPUB 3.0 style packaging (OPF `version="3.0"` + `nav.xhtml`).

XHTML validity:
- `GoogleDoc/Untitled.xhtml` parses as strict XML.
- No named HTML entities like `&nbsp;` observed in the content.

Notes:
- This file behaves like "browser-exported XHTML" and is resilient.

### `sample/mozhno-li-rabotat.epub`
Packaging / structure:
- Standard EPUB2-ish structure (`OEBPS/content.opf`, `OEBPS/toc.ncx`, `OEBPS/chapter1.xhtml`).

XHTML validity:
- `OEBPS/chapter1.xhtml` contains `&nbsp;` many times (224 occurrences observed).
- Strict XML parse fails: `undefined entity &nbsp;`.
- After replacing `&nbsp;` -> `&#160;`, the chapter parses as XML OK.

Likely reader behavior:
- Readers that parse `chapter*.xhtml` as strict XML/XHTML can refuse to open the book or "hang".
- Readers that use a tolerant HTML parser may still open it (and silently repair entities).

### `sample/mcp-server-dlya.epub`
Packaging / structure:
- Same EPUB2 structure (`OEBPS/content.opf`, `toc.ncx`, `chapter1.xhtml`).

XHTML validity:
- `OEBPS/chapter1.xhtml` contains a small number of `&nbsp;` (4 occurrences observed).
- Strict XML parse fails for the same reason (`&nbsp;` undefined).
- After replacing `&nbsp;` -> `&#160;`, the chapter parses as XML OK.

Other observations:
- `OEBPS/content.opf` contains `<meta name="cover" content="cover"/>` but manifest has no `id="cover"` item.
  - This is usually non-fatal, but it is inconsistent metadata.

### `sample/everyone-should-be.epub`
Packaging / structure:
- Same EPUB2 structure with many images (large archive).

XHTML validity:
- `OEBPS/chapter1.xhtml` contains `&nbsp;` (1 occurrence observed).
- Strict XML parse fails for the same reason (`&nbsp;` undefined).
- After replacing `&nbsp;` -> `&#160;`, the chapter parses as XML OK.

Other observations:
- Same cover metadata mismatch as above:
  - OPF includes `<meta name="cover" content="cover"/>`, but no manifest `id="cover"` item.

## Why Some Open Anyway (Even If XML-Invalid)
Even when `chapter1.xhtml` is not strict XML, some reader stacks still open the EPUB because they:
- parse "XHTML" as forgiving HTML, not as strict XML; and/or
- special-case `&nbsp;` as a known entity; and/or
- ignore external DTD resolution issues.

PocketBook behavior varies by model/firmware/rendering pipeline. The repo’s own ADR notes that some PocketBook EPUB2 renderers treat `chapter*.xhtml` as strict XML.

## Recommendations (What to Add to the Fix)
These are ordered by impact on "won't open" failures.

1. **Sanitizer: normalize named HTML entities in chapter XHTML**
   - Minimal critical fix: `&nbsp;` -> `&#160;` (case-insensitive).
   - Optional hardening: convert/strip any other named entities (except the 5 XML-predefined ones: `amp`, `lt`, `gt`, `quot`, `apos`).
   - This should live in `epub/sanitize_xhtml.js` so it applies to:
     - normal generation, and
     - `scripts/repair_epub.js`.

2. **Template: remove external XHTML 1.1 DTD from chapter template**
   - `epub/templates/chapter-xhtml.js` currently emits:
     - `<!DOCTYPE html PUBLIC ... "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">`
   - External DTD fetch is often blocked/unavailable in readers, and it encourages reliance on named entities.
   - With strict XML + numeric entities, the DTD is not required for successful parsing.

3. **Metadata: stop emitting cover meta unless a real cover item exists**
   - `epub/templates/content-opf.js` currently always emits:
     - `<meta name="cover" content="cover"/>`
   - But generated sample OPFs do not include a manifest `<item id="cover" ...>`.
   - Suggestion:
     - either remove this line by default, or
     - make it conditional on actually generating a cover.

4. **Title extraction: avoid NBSP-only titles becoming empty**
   - If a page title element contains only NBSP characters, current selection logic can accept it and then `cleanText()` turns it into empty output.
   - Fix `extractTitle()` to check the cleaned text (post-`cleanText`) is non-empty before returning it.

## Test Additions Suggested
- Unit test for `sanitizeXhtml()`:
  - Input containing `&nbsp;` should output XML-parseable XHTML (use an XML parser in tests).
  - Output should not contain `&nbsp;`.
- Optional: add fixtures based on `sample/mozhno-li-rabotat.epub` chapter content (or a minimized snippet) to prevent regression.

