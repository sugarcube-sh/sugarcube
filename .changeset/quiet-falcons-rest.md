---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
"@sugarcube-sh/vite": patch
---

Refactor: CSS rendering moved out of the token pipeline and into the CSS output step. Tokens stay generic all the way through. This makes it easy to add other output formats (Swift, JS, SCSS, Android) later without touching the token type.

Anything called "convert"/"converter" is now "render"/"renderer". Existing imports just need a find-and-replace.

**`@sugarcube-sh/core`**

- **Tokens no longer carry CSS output.** The `$cssProperties` field is gone from `RenderableToken`.
- **`$resolvedValue` removed from `RenderableToken`.** It's still on `ResolvedToken`, but nothing downstream used it on the renderable token, so we stopped duplicating it.
- **Public type renames:**
  - `ConvertedToken` -> `RenderableToken`
  - `ConvertedTokens` -> `RenderableTokens`
  - `NormalizedConvertedTokens` -> `NormalizedRenderableTokens`
- **Pipeline composition changed.** `convertTokens()` is gone. Compose the two steps yourself:
  ```ts
  // Before
  const tokens = await convertTokens(trees, resolved, config, validationErrors);

  // After
  const tokens = assignCSSNames(groupByContext(trees, resolved), config, validationErrors);
  ```
  Both `groupByContext` and `assignCSSNames` are exported from `@sugarcube-sh/core` and `/client`.
- **New: `renderCSS(token, options)`**. Turns a single token into its CSS-shaped value. The CSS emitter calls this; future formats will get sibling functions like `renderJS` and `renderSwift`.
- **New: `assignCSSNames(tokens, config, validationErrors?)`**. Sets `$names.css` on every token and drops any flagged invalid by validation. This is the new home for the naming work that used to live inside `convertTokens`.
- **Directory rename**: `src/shared/converters/` -> `src/shared/renderers/css/`. Other formats will live next to it: `renderers/js/`, `renderers/swift/`, etc.
- **Internal symbol renames:**
  - `converters` registry -> `cssRenderers`
  - 14 × `convert<Type>Token` functions -> `render<Type>` (e.g. `convertColorToken` -> `renderColor`)
  - `ConversionOptions` -> `CSSRenderOptions`
  - `TokenConverter<T>` -> `CSSRenderer<T>`
  - `convertReferenceToCSSVar` -> `substituteReferencesAsCSSVars`
- **Pipeline step rename:** `apply-converters` -> `assign-css-names`. The step no longer runs converters; it just sets `$names.css` and drops invalid tokens.
- **Fixture fix:** typography and shadow test fixtures had `$value` shapes that didn't match DTCG (e.g. `fontSize: "16px"` instead of `{ value: 16, unit: "px" }`). The old emitter masked this by reading a hand-written `$cssProperties` cache. The new pipeline reads `$value` directly, so the broken fixtures started failing — they're now DTCG-valid.

**`@sugarcube-sh/cli`, `@sugarcube-sh/vite`**

- Internal: updated to the new pipeline shape (`groupByContext` + `assignCSSNames` instead of `convertTokens`). No user-visible change.
