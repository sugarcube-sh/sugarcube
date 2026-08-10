---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
---

Add `sugarcube analyze`. The command reports what's true about your token system:

- `analyze unused` lists tokens no CSS reaches, following alias chains through the new token dependency graph, so primitives consumed only via aliases are correctly counted as used.
- `analyze impact <token>` shows everything a change would touch.

Both subcommands support `--json`. `unused` adds `--all` for a flat, pipe-friendly list. `impact` adds `--tree` (indented chains) and `--brief` (ranked by use, pass-through tokens hidden).

Core now exposes a reusable token dependency graph for this: `buildTokenGraph`, `reachableFrom`, `findUnusedTokens`, `directDependents`, `dependentsOf`, and `dependentsVia`.
