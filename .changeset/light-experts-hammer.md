---
"@sugarcube-sh/core": patch
---

**New: scale recipes.** Generate a family of fluid dimension tokens from a single group node by authoring a recipe under `$extensions["sh.sugarcube"].scale`. Sugarcube generates (virtually) the children during the expand pass, and each generated token carries a `sh.sugarcube.fluid` extension so the existing fluid renderer emits `clamp()` — virtual scale tokens are indistinguishable from hand-authored fluid tokens by the time they hit CSS.

At present, no actual tokens are written to disk or outputted.

Two modes:

- **`exponential`**: base min/max + a min/max ratio + step counts. Generates symmetric steps around the base (e.g. `-2, -1, 0, 1, 2`).
- **`multipliers`**: base min/max + a `Record<string, number>` of named multipliers. Optionally generates space pairs (`"adjacent"` for `sm-md`, `md-lg`, …, or an explicit list like `["sm-lg", "xs-xl"]`).

```ts
{
  $extensions: {
    "sh.sugarcube": {
      scale: {
        mode: "exponential",
        base: { min: { value: 1, unit: "rem" }, max: { value: 1.125, unit: "rem" } },
        ratio: { min: 1.2, max: 1.25 },
        steps: { negative: 2, positive: 5 },
      },
    },
  },
}
```

Malformed recipes surface as `ExpandError`s; the group is left intact (without generated children) and the rest of the pipeline continues.

**New exports (from `@sugarcube-sh/core` and `/client`):**

- `calculateScale(config)` — pure function that returns the generated steps without going through the pipeline. Useful for previews / studio controls.
- Types: `ScaleExtension`, `ExponentialScaleConfig`, `MultiplierScaleConfig`, `FluidExtension`, `SugarcubeExtensions`, `GeneratedStep`.

**`ScaleBinding` semantics clarified.** A scale binding now dispatches purely on whether a recipe is authored at the bound path:

- Recipe present -> recipe-aware controls; the recipe's `mode` field tells consumers whether to render exponential or multipliers UI.
- No recipe -> bulk controls (base + spread) plus per-step inputs for direct editing of the concrete tokens.
