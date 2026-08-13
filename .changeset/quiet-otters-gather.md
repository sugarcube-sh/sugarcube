---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
---

Fix `analyze impact` dropping parents when a token points somewhere different in each context.

If a shared token has one parent per brand, theme, or variant, the tree used to keep only the first parent it found. The rest looked unused — e.g. five of six variants showing `0` uses — even though each was referenced under its own context.

Now:

- The tree lists the token under every parent. One row carries the subtree; the others point at it, e.g. `v.on-strong (per variant, above)`.
- The table's `References` column does the same: `color.info.on-strong (per variant)`.
- The label names the axis that decides the parent (`per variant`, or `per context` when more than one modifier decides).
- The subtree hangs off the **default context** (what the token resolves to at `:root`). Usage counts only break remaining ties, so a single hardcoded `var()` can't reshape the tree.
- Default context comes from the resolver: a modifier's own `default` means `input: {}` and `input: { variant: "accent" }` count as the same permutation when `accent` is that default.

`TokenGraph` gains `defaultContext`, and `buildTokenGraph` accepts `modifierDefaults`. It's omitted when there's no single answer.

`analyze impact --json` now reports every hop: **`dependents[].references` is an array**, not a string. Core adds `dependentsParents` for that; `dependentsVia` still returns the first hop.
