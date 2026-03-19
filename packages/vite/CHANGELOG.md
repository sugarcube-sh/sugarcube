# @sugarcube-sh/vite

## 0.1.5

### Patch Changes

- Updated dependencies [16fba95]
  - @sugarcube-sh/core@0.1.4

## 0.1.4

### Patch Changes

- Updated dependencies [a74b2ac]
  - @sugarcube-sh/core@0.1.3

## 0.1.3

### Patch Changes

- Updated dependencies [81d2e33]
  - @sugarcube-sh/core@0.1.2

## 0.1.2

### Patch Changes

- 3135180: Fix HMR not triggering when design token files change. Thanks @mark-tomlinson-dev

  Removed `server.watcher.add()` calls for config and token file watching. Vite already watches the project root by default, so explicitly adding watch patterns was
  unnecessary and caused intermittent failures due to chokidar timing issues. Now we simply listen for change events and filter for our files.

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
