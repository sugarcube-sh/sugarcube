# @sugarcube-sh/cli

## 0.1.9

### Patch Changes

- 06cd5cb: Add `variables.prefix` and `variables.variableName` config options for controlling generated CSS variable names.

  **`@sugarcube-sh/core`**

  - New `variables.prefix` option: prepends a string to every generated CSS variable name (e.g. `prefix: "ds"` → `--ds-color-brand-primary`). Flows through declarations, `var(--…)` references, and utility-class output automatically.
  - New `variables.variableName` option: `(path: string) => string` callback for full control over naming. Overrides `prefix` when both are set. Useful for kebab-casing, custom separators, etc.
  - Export `kebabCase(str)` helper. Shipped as a convenience for users.
  - Export `createVariableNameResolver(variables)` — builds a bound resolver function from a `variables` config, for consumers (Studio, external tools) that need to construct `var(--…)` strings matching emitted CSS.
  - Export `VariableNameFn` type.
  - Internal: CSS variable names are now computed once per token during the convert step and stored on `token.$names.css`. Declarations, references (`{color.primary}` -> `var(--…)`), and utility-class rules all read from this single source — eliminating a latent bug where references with camelCase path segments (e.g. `{color.brandPrimary}`) produced names that didn't match their declarations.

  **`@sugarcube-sh/cli`**

  - New `--prefix <string>` flag on `sugarcube generate`. Mirrors `variables.prefix` so users can prepend a CSS variable prefix without needing a config file. Pass the prefix without the leading `--` (e.g. `--prefix ds` produces `--ds-color-foo`). Overrides `variables.prefix` if a config file is present.
  - Re-export `kebabCase` and the `VariableNameFn` type.

  **`@sugarcube-sh/vite`**

  - Re-export `kebabCase` and the `VariableNameFn` type so users can import everything they need from whichever entry point they already use.

- Updated dependencies [06cd5cb]
  - @sugarcube-sh/core@0.2.3

## 0.1.8

### Patch Changes

- Updated dependencies [5c23423]
  - @sugarcube-sh/core@0.2.2

## 0.1.7

### Patch Changes

- 3a06216: **`@sugarcube-sh/cli`**

  - Bump `chokidar` to `^5.0.0`. v4.0.3 was published without provenance, causing `pnpm install` to fail silently under `trustPolicy: no-downgrade`. ([#75](https://github.com/sugarcube-sh/sugarcube/issues/75))
  - Surface package-manager stderr when `sugarcube init` fails to install dependencies. Previously the underlying error (e.g. pnpm trust-policy rejections, network failures) was swallowed and replaced with a generic message, making install failures hard to diagnose.
  - Raise minimum Node version to `>=20.19.0`. Node 18 has been EOL since April 2025 and the effective floor was already 20.19 via transitive deps.

  **`@sugarcube-sh/core`**

  - Raise minimum Node version to `>=20.19.0` to match the CLI.

- 454cdbd: Thread Studio support through `core`, `cli`, and `vite`. Studio itself ships as separate workspace packages (`@sugarcube-sh/studio`, `-vite`, `-embed`, `-node`) that aren't published yet.

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

- a74bfa1: Restructure `@sugarcube-sh/core` internals with a clearer pure/Node split and a four-function pipeline. No config, CLI, or Vite plugin API changes.

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

- Updated dependencies [3a06216]
- Updated dependencies [454cdbd]
- Updated dependencies [a74bfa1]
- Updated dependencies [c59cf38]
  - @sugarcube-sh/core@0.2.1

## 0.1.6

### Patch Changes

- 170b9e3: Fix missing spacing before the permutations warning when using the `--input` flag.
- Updated dependencies [c4fec95]
- Updated dependencies [8477fd8]
- Updated dependencies [7a60f94]
- Updated dependencies [1c5833f]
  - @sugarcube-sh/core@0.2.0

## 0.1.5

### Patch Changes

- Updated dependencies [ef0695d]
  - @sugarcube-sh/core@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [16fba95]
  - @sugarcube-sh/core@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [a74b2ac]
  - @sugarcube-sh/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [81d2e33]
  - @sugarcube-sh/core@0.1.2

## 0.1.1

### Patch Changes

- a1f3363: Release retry after npm provenance bug
- Updated dependencies [a1f3363]
  - @sugarcube-sh/core@0.1.1

## 0.1.0

### Minor Changes

- 4746a39: Redesign init as an interactive wizard @mark-tomlinson-dev

  `init` now walks you through setup step-by-step, prompting for starter kit, CUBE CSS, components, and Vite plugin. The CLI is installed locally by default, enabling the shorter `sugarcube` command.

  Init flags are now limited to directories it writes directly:

  - `--tokens-dir`, `--cube-dir`, `--components-dir`

  Removed flags that belong to CSS generation:

  - `--styles-dir`, `--variables-dir`, `--variables-filename`
  - `--utilities-dir`, `--utilities-filename`
  - `--fluid-min`, `--fluid-max`, `--color-fallback`
  - `--skip-deps`, `--kit` (now a prompt)

  Use `sugarcube.config.ts` or `generate` flags to customize CSS output.

  Also: `generate` no longer errors when the Vite plugin is installed.

### Patch Changes

- Updated dependencies [4746a39]
  - @sugarcube-sh/core@0.1.0

## 0.0.4

### Patch Changes

- 55c3e87: Use caret ranges for ecosystem dependencies (jiti, pathe, @unocss/\*) to improve compatibility when deduping with other packages in consumer projects. @mark-tomlinson-dev
- 4e8985c: Added watch mode (`--watch`) to `generate` command
- Updated dependencies [55c3e87]
- Updated dependencies [4e8985c]
  - @sugarcube-sh/core@0.0.4

## 0.0.3

### Patch Changes

- 544810b: Add CSS cascade layers support

  **Vite plugin**: Pass `outputToCssLayers` via `unoOptions` to wrap output in `@layer` blocks:

  ```ts title="vite.config.ts"
  sugarcube({
    unoOptions: {
      outputToCssLayers: {
        cssLayerName: (layer) => {
          if (layer === "preflights") return "base";
          if (layer === "default") return "utilities";
          return layer;
        },
      },
    },
  });
  ```

  CLI: Use output.layers to wrap generated CSS in @layer blocks:

  ```ts title="sugarcube.config.ts"
  defineConfig({
    output: {
      layers: {
        variables: "base",
        utilities: "utilities",
      },
    },
  });
  ```

- Updated dependencies [544810b]
  - @sugarcube-sh/core@0.0.3
