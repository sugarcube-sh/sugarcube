---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
"@sugarcube-sh/vite": patch
---

Refactor the token pipeline so rendering is format-specific and happens at emit time. Tokens now leave the pipeline format-neutral — CSS-specific output is no longer baked into the token type. This is the foundation for future format outputs (Swift, JS, SCSS, Android) without further restructuring.

**Breaking: public type and helper renames.** The token type, pipeline composition helpers, and internal converter vocabulary have been renamed to use "render/renderer/renderable" terminology consistently. Import renames are mechanical; no behavioural changes for existing CSS-only consumers.

**`@sugarcube-sh/core`**

- **Tokens are format-neutral after the pipeline.** `$cssProperties` (eager CSS rendering baked into each token) has been removed from the `RenderableToken` type. CSS rendering now happens lazily at emit time, via `renderCSS(token, options)`. Anyone who previously read `token.$cssProperties` should call `renderCSS(token, options)` instead.
- **`$resolvedValue` dropped from `RenderableToken`.** Still present on `ResolvedToken` (the resolver's observable output); nothing downstream consumed it on the converted token. Saves carrying a duplicate field.
- **Public type renames (breaking):**
  - `ConvertedToken` → `RenderableToken`
  - `ConvertedTokens` → `RenderableTokens`
  - `NormalizedConvertedTokens` → `NormalizedRenderableTokens`
- **Pipeline composition changed (breaking):** `convertTokens()` has been removed. Consumers now compose the pipeline explicitly:
  ```ts
  // Before
  const tokens = await convertTokens(trees, resolved, config, validationErrors);

  // After
  const tokens = assignCSSNames(groupByContext(trees, resolved), config, validationErrors);
  ```
  Both `groupByContext` and `assignCSSNames` are exported from `@sugarcube-sh/core` and `/client`.
- **New module**: `renderCSS(token, options)` — the emit-time CSS rendering entry point. Used by the CSS emitter; future format entries (`renderSwift`, `renderJS`) will live alongside.
- **New module**: `assignCSSNames(tokens, config, validationErrors?)` — populates `$names.css` on each token and drops validation-flagged tokens. Replaces the naming step previously bundled inside `convertTokens`.
- **Directory rename**: `src/shared/converters/` → `src/shared/renderers/css/`. Anticipates `renderers/js/`, `renderers/swift/` etc. as sibling directories.
- **Internal symbol renames**:
  - `converters` registry → `cssRenderers`
  - 14 × `convert<Type>Token` functions → `render<Type>` (e.g. `convertColorToken` → `renderColor`)
  - `ConversionOptions` → `CSSRenderOptions`
  - `TokenConverter<T>` → `CSSRenderer<T>`
  - `convertReferenceToCSSVar` → `substituteReferencesAsCSSVars`
- **Architectural move**: `apply-converters` pipeline step renamed to `assign-css-names`. The step no longer runs any converters; its current job is populating `$names.css` and filtering tokens flagged by validation.
- **Fixture/bug fix**: typography and shadow test fixtures had non-DTCG `$value` shapes (e.g. `fontSize: "16px"` as a string instead of `{ value: 16, unit: "px" }`). The old emitter read a hand-authored `$cssProperties` cache that hid the mismatch; the new pipeline renders from `$value` and surfaces these. Fixtures are now DTCG-valid by construction.

**`@sugarcube-sh/cli`, `@sugarcube-sh/vite`**

- Internal: callers updated to the new pipeline composition (`groupByContext` + `assignCSSNames` instead of `convertTokens`). No user-facing change.
