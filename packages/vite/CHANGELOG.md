# @sugarcube-sh/vite

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
