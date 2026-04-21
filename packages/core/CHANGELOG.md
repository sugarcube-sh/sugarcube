# @sugarcube-sh/core

## 0.2.1

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

- c59cf38: Added client entry point for non-node environments

## 0.2.0

### Minor Changes

- c4fec95: ### Permutations API

  Thanks @aarongeorge for the feature request!

  A new DTCG-aligned permutations API for multi-brand and multi-theme CSS builds. Each permutation declares an `input`, `selector`, and optional `atRule` and `path`:

  ```ts
  defineConfig({
    variables: {
      permutations: [
        { input: { theme: "light" }, selector: ":root" },
        {
          input: { theme: "dark" },
          atRule: "@media (prefers-color-scheme: dark)",
        },
      ],
    },
  });
  ```

  When no permutations are defined, they are auto-generated from the resolver's modifiers (default context → `:root`, non-default → `[data-{modifier}="{context}"]`).

  Delta optimisation: non-default permutations only emit tokens that differ from the base.

  Per-permutation `path` allows splitting themes into separate output files.

  ### CLI: `--input` flag

  The new `--input` flag builds a single inline permutation, ignoring any config permutations. Pair with `--selector` to control the output selector (defaults to `:root`):

  ```sh
  sugarcube generate --input theme=dark --input brand=ocean
  ```

  Also adds `--variables-only` and `--utilities-only` flags, and replaces the old directory/filename flags with `--variables <path>` and `--utilities <path>`.

  ### Breaking: Config schema reworked

  The `output` object has been replaced with a flatter structure:

  | Before                                                | After                                 |
  | ----------------------------------------------------- | ------------------------------------- |
  | `output.variables` + `output.variablesFilename`       | `variables.path`                      |
  | `output.utilities` + `output.utilitiesFilename`       | `utilities.path`                      |
  | `output.layers.variables` / `output.layers.utilities` | `variables.layer` / `utilities.layer` |
  | `output.components`                                   | `components` (top-level)              |
  | `output.cube`                                         | `cube` (top-level)                    |
  | top-level `transforms`                                | `variables.transforms`                |
  | top-level `utilities` (record)                        | `utilities.classes`                   |

  Modifier `selector`/`atRule` extensions are no longer read from the resolver document — output selectors and at-rules are now defined in config permutations.

  The top-level `input` config option has been removed. Use `variables.permutations` instead, or the `--input` CLI flag.

  `prefersColorScheme` modifier extension is now deprecated — it produces warnings instead of errors. Use `variables.permutations` with `atRule` instead.

  ### Breaking: CLI flag renames

  | Before             | After          | Command      |
  | ------------------ | -------------- | ------------ |
  | `--tokens-dir`     | `--tokens`     | `init`       |
  | `--cube-dir`       | `--cube`       | `init`       |
  | `--components-dir` | `--components` | `init`       |
  | `--cube-dir`       | `-o, --output` | `cube`       |
  | `--components-dir` | `--output`     | `components` |

  ### Migration

  1. Replace `output: { ... }` with `variables: { path }` and `utilities: { path }`
  2. Move `transforms` into `variables.transforms`
  3. Move utility class definitions into `utilities.classes`
  4. Move layer config into `variables.layer` / `utilities.layer`
  5. Remove `sh.sugarcube.selector` and `sh.sugarcube.atRule` extensions from resolver modifiers
  6. Define `variables.permutations` for multi-theme/multi-brand output
  7. Replace `input: { ... }` in config with an equivalent `variables.permutations` entry
  8. Update CLI invocations: `--variables <path>`, `--utilities <path>`, `--input` replaces old flags
  9. Rename CLI flags: `--tokens-dir` → `--tokens`, `--cube-dir` → `--cube`/`-o`, `--components-dir` → `--components`/`--output`

### Patch Changes

- 8477fd8: ### DTCG 2025.10 Format Module support

  Thanks @binyamin for raising this issue.

  Adds support for the remaining DTCG 2025.10 Format Module features:

  - **`$root`** — root tokens in groups (spec 6.2)
  - **`$extends`** — group inheritance via deep merge (spec 6.4)
  - **`$ref`** — JSON Pointer references for tokens and groups (spec 6.6.2)

  `$ref` references are normalised to curly brace format before flattening. `$extends` performs a deep merge where local tokens override inherited ones at the same path. Both support circular reference detection.

  Closes #57

- 7a60f94: ### Fix: config changes now hot-reload in the browser

  Changes to `sugarcube.config.ts` (permutation selectors, transforms, utility config, etc.) now take effect via HMR without restarting the dev server.

  Previously, config changes were detected but the browser never received the updated CSS. Two issues:

  1. **Stale config** — `jiti` cached the config module between reloads, so the pipeline regenerated CSS from the old config values.
  2. **Missing token reload** — config changes that affect permutations require re-running the full token pipeline, not just regenerating CSS from already-resolved tokens.

- 1c5833f: ### Fluid dimensions as extension

  Fluid dimensions are now expressed as a standard `dimension` token with an `sh.sugarcube.fluid` extension, replacing the non-standard `fluidDimension` token type:

  ```json
  {
    "$type": "dimension",
    "$value": { "value": 1, "unit": "rem" },
    "$extensions": {
      "sh.sugarcube": {
        "fluid": {
          "min": { "value": 0.875, "unit": "rem" },
          "max": { "value": 1.5, "unit": "rem" }
        }
      }
    }
  }
  ```

  The `$value` serves as a static fallback while `fluid.min` and `fluid.max` define the clamp range. This aligns with the DTCG spec's extension mechanism and makes fluid tokens interoperable with tools that understand standard `dimension` tokens.

  `$type: "fluidDimension"` still works but produces a deprecation warning.

  ### Fluid extension validation

  The `sh.sugarcube.fluid` extension is validated — `min` and `max` must both be valid dimension objects with numeric values and `px`/`rem` units.

  ### Pipeline context

  Introduces `PipelineContext`, a shared context threaded through pipeline stages for emitting warnings and events:

  - Any pipeline stage can emit warnings via `context.warn()` without changing its return type
  - Warnings are automatically deduplicated by path + message (fixes duplicate warnings when tokens appear across multiple permutations)
  - Consumers (CLI, Vite plugin, Studio) can provide an `emit` handler for real-time pipeline events
  - Exported as `createPipelineContext()` for consumer use

  ### Warning and error deduplication

  Validation errors are now deduplicated — the same token appearing across multiple permutations no longer produces duplicate error messages.

  ### Warning messages

  Warning messages are now centralized in `WarningMessages` (mirroring the existing `ErrorMessages` pattern), separating them from error messages.

  ### Pipeline refactor

  Resolver document parsing is now a distinct pipeline stage (`parseResolver`), separating it from token loading. This gives the pipeline context access to resolver warnings directly rather than forwarding them after the fact.

## 0.1.5

### Patch Changes

- ef0695d: Add `prefersColorScheme` extension for automatic theme switching. Thanks @aninusmuffin, @arpit-agr.

  Modifiers can now use `@media (prefers-color-scheme)` queries instead of data attributes by adding `prefersColorScheme: true` to the modifier's `$extensions`:

  ```json
  {
    "type": "modifier",
    "name": "theme",
    "default": "light",
    "contexts": {
      "light": [],
      "dark": [{ "$ref": "./dark.json" }]
    },
    "$extensions": {
      "sh.sugarcube": {
        "prefersColorScheme": true
      }
    }
  }
  ```

  This generates CSS that automatically follows the user's OS preference:

  ```css
  :root {
    /* light values */
  }
  @media (prefers-color-scheme: dark) {
    :root {
      /* dark overrides */
    }
  }
  ```

  Validation ensures:

  - Context names must be `light` and `dark` only
  - Non-default contexts must have token sources (otherwise the media query would be empty)

## 0.1.4

### Patch Changes

- 16fba95: fix: preserve group-level $type inheritance in modifier contexts. Thanks @leannerenard.

  Modifier override files using group-level $type (e.g., `{ "color": { "$type": "color", "primary": { "$value": "#fff" } } }`) now correctly generate CSS. Previously, the group structure was lost during context processing, causing tokens to be silently filtered out.

  Also adds validation to error when tokens have literal values but no $type (either explicit or inherited), rather than silently producing no output.

## 0.1.3

### Patch Changes

- a74b2ac: fix: border and gradient color object tokens no longer output as [object Object].

## 0.1.2

### Patch Changes

- 81d2e33: fix: shadow token color objects no longer output as [object Object]. (Thanks @Kiwow for reporting).

## 0.1.1

### Patch Changes

- a1f3363: Release retry after npm provenance bug

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

## 0.0.4

### Patch Changes

- 55c3e87: Use caret ranges for ecosystem dependencies (jiti, pathe, @unocss/\*) to improve compatibility when deduping with other packages in consumer projects. @mark-tomlinson-dev
- 4e8985c: Added watch mode (`--watch`) to `generate` command

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
