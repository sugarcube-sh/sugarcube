---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
---

Stop `analyze impact` hiding edges when a token points somewhere different in each context.

If you define a token once per context — a file per brand, theme or variant, each pointing at its own sibling — that token genuinely has one parent per context. `analyze impact` only recorded the first one it found, so the tree drew the token under a single arbitrary parent and the others looked as though nothing referenced them.

In a system with six variants, five of them showed `0` uses and no children, when each was the target of the shared token under its own variant and drove every one of its usages. The count was never wrong but the shape expressed by the tree was misleading or at least hard to parse and therefore less useful than it should be.

Three changes:

- The tree lists such a token under **every** parent, so none of them looks unreferenced. One row carries the subtree; the rest are marked and point at it, e.g. `v.on-strong (per variant, above)`.
- The default table view marks it too. Its `References` column names one hop, which read as the whole answer — it now says `color.info.on-strong (per variant)`.
- The axis those parents vary along is named, taken from the graph rather than guessed: `(per variant)`, or `(per context)` where more than one modifier decides. It's the modifier that *decides* which parent applies, so writing permutations as a matrix — variant × theme — still reports `per variant` rather than giving up, even though `theme` varies across those edges too.
- The row that carries the subtree is the one the **default context** points at — what the token resolves to at `:root`, and so what most of a site renders. Usage counts only break the remaining ties, deliberately: otherwise one hardcoded `var()` in one file would decide the tree's shape, and deleting that line would silently reshape it.
- Which permutation is the default comes from the resolver, not from how the config is typed. Per resolver spec §4.1.5.3 a modifier declares its own `default` context, so `input: {}` and `input: { variant: "accent" }` are recognised as the same permutation when `accent` is that default — previously only the empty form was.

Core's `TokenGraph` gains `defaultContext`, naming that context, and `buildTokenGraph` accepts `modifierDefaults` to work it out. It's absent rather than guessed when there's no single answer — no declared defaults to compare an explicit input against, or several contexts qualifying.
- `analyze impact --json` reports every hop. **`dependents[].references` is now an array** rather than a single string, so a consumer sees all the edges rather than one.

Core gains `dependentsParents`, which returns every hop for each dependent. `dependentsVia` is unchanged for callers — it now reads the first hop off the richer result.
