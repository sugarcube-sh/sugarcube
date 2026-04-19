---
"@sugarcube-sh/core": patch
"@sugarcube-sh/vite": patch
"@sugarcube-sh/cli": patch
---

Thread Studio support through `core`, `cli`, and `vite`. Studio itself ships as separate workspace packages (`@sugarcube-sh/studio`, `-vite`, `-embed`, `-node`) that aren't published yet.

**`@sugarcube-sh/core`**

- Add Studio config types and schema: `StudioConfig`, `ColorScaleConfig`, `PanelSection`, `BindingSection`, `PanelBinding` (discriminated union of `ColorBinding` | `PresetBinding` |
  `ScaleBinding` | `ScaleLinkedBinding` | `PaletteSwapBinding`). Exported from both main and `/client` entries. `SugarcubeConfig.studio` is now a validated optional field.
- Export `isResolvedToken` type guard and `ResolvedToken` type from both entries, so browser-side consumers can narrow resolved tokens without importing Node-only code.
- Export `formatCSSVarName(path)` — the canonical path→CSS-variable-name formatter used by the pipeline, so external tools can build `var(--…)` strings guaranteed to match emitted CSS.
- Flattened tokens now carry per-file `$source.sourcePath` attribution. Dursolution each merged source file stamps `$sourcePath` on its tokens, so resolved tokens trace back to the
  actual file that defined them rather than the root resolver document.
- Internal: consolidate `isToken` / `isGroup` helpers into `guards/token-guards.ts`; reuse `formatCSSVarName` in `pipeline/generate.ts` in place of the duplicated local `formatCSSVarPath`.
- Remove `PerfMonitor` / `Instrumentation` from the `/client` entry (still available from the main entry). These are Node-oriented debugging helpers not intended for browser use.

**`@sugarcube-sh/cli`**

- Add `sugarcube studio build`. Writes a token snapshot (`snapshot.json`) alongside the Studio SPA and embed script to an output directory (default `.sugarcube/`), ready to be served as
  static assets for an embedded Studio surface.

**`@sugarcube-sh/vite`**

- Widen Vite peer range to include `^8`.
- Expose `trees` and `resolved` on the plugin context, so external tools can inspect raw token trees and resolved tokens without re-running the pipeline.
- Add `ctx.writeTokenEdits(sourcePath, edits)` — persists JSON Pointer-style edits to a token source file using `jsonc-parser` so comments and formatting are preserved.
- Add `ctx.rerunPipeline(modifiedResolved)` — re-runs token conversion and CSS generation against a mutated resolved-tokens object without re-reading files. Enables live-preview of edits
  before persistence.
- New runtime dep: `jsonc-parser`.
