---
"@sugarcube-sh/core": patch
---

feat: add opt-in `variables.propagateDependents` config. When enabled, modifier selectors re-emit any base variable that references a changed variable (e.g. `--semantic: var(--binding)`, following the chain transitively), so multi-step token chains resolve correctly under nested `data-theme` / `data-mode` scoping. Also covers composite values like shadows whose color references a changed variable. Off by default (existing output is unchanged).
