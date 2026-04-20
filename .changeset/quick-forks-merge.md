---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
"@sugarcube-sh/vite": patch
---

Restructure `@sugarcube-sh/core` internals with a clearer pure/Node split and a four-function pipeline. No config, CLI, or Vite plugin API changes.

**Internal**

- `packages/core/src/` is now split into `shared/` (runs anywhere) and `node/` (Node-only). The Node/pure boundary is visible at the directory level.
- `@sugarcube-sh/core/client` is now structurally pure — zero `node:` imports in the browser bundle.
- Pipeline functions renamed to the four-function chain:
    - `loadAndResolveTokens` → `loadTokens` (Node) + `resolveTokens` (pure)
    - `processAndConvertTokens` → `convertTokens`
    - `generateCSSVariables` unchanged
- The main entry now re-exports the full `/client` surface, so types like `ConvertedToken`, `ConvertedTokens`, and the full DTCG type set are available from both entries.
- `utils/` junk drawer eliminated; `process-trees` + `normalize` pipeline stages merged into a single `groupByContext`.

If you were importing `loadAndResolveTokens` or `processAndConvertTokens` directly from `@sugarcube-sh/core`, see the new four-function chain in `src/node/load-tokens.ts` and `src/shared/*-tokens.ts`.
