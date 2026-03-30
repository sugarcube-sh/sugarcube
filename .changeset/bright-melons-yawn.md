---
"@sugarcube-sh/core": minor
---

### Permutations API

A new DTCG-aligned permutations API for multi-brand and multi-theme CSS builds. Each permutation declares an `input`, `selector`, and optional `atRule` and `path`:

```ts
defineConfig({
  variables: {
    permutations: [
      { input: { theme: "light" }, selector: ":root" },
      { input: { theme: "dark" }, selector: "[data-theme='dark']" },
      { input: { theme: "dark" }, atRule: "@media (prefers-color-scheme: dark)" },
    ],
  },
});
```

When no permutations are defined, they are auto-generated from the resolver's modifiers (default context → `:root`, non-default → `[data-{modifier}="{context}"]`).

Delta optimization: non-default permutations only emit tokens that differ from the base.

Per-permutation `path` allows splitting themes into separate output files.

### CLI: `--input` flag

The new `--input` flag builds a single inline permutation, ignoring any config permutations. Pair with `--selector` to control the output selector (defaults to `:root`):

```sh
sugarcube generate --input theme=dark --input brand=ocean
```

Also adds `--variables-only` and `--utilities-only` flags, and replaces the old directory/filename flags with `--variables <path>` and `--utilities <path>`.

### Breaking: Config schema reworked

The `output` object has been replaced with a flatter structure:

| Before | After |
|---|---|
| `output.variables` + `output.variablesFilename` | `variables.path` |
| `output.utilities` + `output.utilitiesFilename` | `utilities.path` |
| `output.layers.variables` / `output.layers.utilities` | `variables.layer` / `utilities.layer` |
| `output.components` | `components` (top-level) |
| `output.cube` | `cube` (top-level) |
| top-level `transforms` | `variables.transforms` |
| top-level `utilities` (record) | `utilities.classes` |

Modifier `selector`/`atRule` extensions are no longer read from the resolver document — output selectors and at-rules are now defined in config permutations.

The top-level `input` config option has been removed. Use `variables.permutations` instead, or the `--input` CLI flag.

`prefersColorScheme` modifier extension is now deprecated — it produces warnings instead of errors. Use `variables.permutations` with `atRule` instead.

### Breaking: CLI flag renames

| Before | After | Command |
|---|---|---|
| `--tokens-dir` | `--tokens` | `init` |
| `--cube-dir` | `--cube` | `init` |
| `--components-dir` | `--components` | `init` |
| `--cube-dir` | `-o, --output` | `cube` |
| `--components-dir` | `--output` | `components` |

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
