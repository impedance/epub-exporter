# ADR-0002: PocketBook-Safe XHTML Contract

## Context
PocketBook EPUB2 renderers treat `chapter*.xhtml` as strict XHTML/XML. Browser readers often repair invalid markup, but PocketBook can "freeze" on invalid XHTML.

## Decision
Adopt a minimal, PocketBook-safe XHTML contract for generated chapters:
- **Strict XML parsing required** for `OEBPS/chapter*.xhtml` (no mismatched tags).
- **Void tags must self-close**: `<br />`, `<hr />` (and other voids emitted by the generator).
- **Forbidden elements**: `<picture>`, `<source>`, inline `<svg>`.
- **Allowed core tags** (80/20 subset): `p`, `h1..h6`, `ul`, `ol`, `li`, `a`, `img`, `pre`, `code`, `blockquote`, `div`, `span`, `em`, `strong`, `hr`, `br`.
- **Figure normalization**: `figure`/`figcaption` are flattened into `div`/`p.caption` equivalents.

## Consequences
- EPUB generation must sanitize HTML fragments to meet the contract before packaging.
- Tests must validate strict XML parsing and absence of forbidden patterns on outputs and fixtures.

## Related Docs
- `docs/pocketbook-compat-plan.md`
- `docs/context.md`
