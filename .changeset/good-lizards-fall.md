---
"@sugarcube-sh/core": minor
"@sugarcube-sh/vite": minor
"@sugarcube-sh/cli": minor
---

Redesign init as an interactive wizard @mark-tomlinson-dev

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
