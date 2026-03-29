# @sugarcube-sh/core

## 0.1.6

### Patch Changes

- 8477fd8: ### DTCG 2025.10 Format Module support

  Adds support for the remaining DTCG 2025.10 Format Module features:

  - **`$root`** — root tokens in groups (spec 6.2)
  - **`$extends`** — group inheritance via deep merge (spec 6.4)
  - **`$ref`** — JSON Pointer references for tokens and groups (spec 6.6.2)

  `$ref` references are normalised to curly brace format before flattening. `$extends` performs a deep merge where local tokens override inherited ones at the same path. Both support circular reference detection.

  Closes #57

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
