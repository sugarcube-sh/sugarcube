---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
"@sugarcube-sh/vite": patch
---

Add `variables.prefix` and `variables.variableName` config options for controlling generated CSS variable names.

**`@sugarcube-sh/core`**

- New `variables.prefix` option: prepends a string to every generated CSS variable name (e.g. `prefix: "ds"` → `--ds-color-brand-primary`). Flows through declarations, `var(--…)` references, and utility-class output automatically.
- New `variables.variableName` option: `(path: string) => string` callback for full control over naming. Overrides `prefix` when both are set. Useful for kebab-casing, custom separators, etc.
- Export `kebabCase(str)` helper. Shipped as a convenience for users.
- Export `createVariableNameResolver(variables)` — builds a bound resolver function from a `variables` config, for consumers (Studio, external tools) that need to construct `var(--…)` strings matching emitted CSS.
- Export `VariableNameFn` type.
- Internal: CSS variable names are now computed once per token during the convert step and stored on `token.$names.css`. Declarations, references (`{color.primary}` -> `var(--…)`), and utility-class rules all read from this single source — eliminating a latent bug where references with camelCase path segments (e.g. `{color.brandPrimary}`) produced names that didn't match their declarations.

**`@sugarcube-sh/cli`, `@sugarcube-sh/vite`**

- Re-export `kebabCase` and the `VariableNameFn` type so users can import everything they need from whichever entry point they already use.
