# ADR-0001: README Index + AICODE Anchors + Status Log

## Context
The repo needs fast, stable navigation without relying on fragile line-number links.
Agents and humans should be able to locate entry points, contracts, and traps with a single `rg` query.

## Decision
Adopt the navigation system defined in `aicode-system.md`:
- `README.md` is the index map.
- Short `AICODE-*` anchors live near code.
- Current focus lives in `docs/status.md`.
- Decisions live in `docs/decisions/*`.

## Consequences
- Pros: fast discovery, portable across repos, easy onboarding.
- Cons: requires discipline to keep anchors updated and to run `lint:aicode`.

## Related Docs
- `AGENTS.md`
- `docs/aicode-anchors.md`
- `docs/context.md`
- `docs/status.md`
