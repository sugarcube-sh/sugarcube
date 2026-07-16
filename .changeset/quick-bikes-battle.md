---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
---

Add a `lint` command that checks your CSS and `<style>` blocks (.astro, .vue, .svelte, etc.) for `var()` references to token variables that don't exist, catching typos and references to tokens you've renamed or removed. It derives your token names the same way `generate` does, so there's no build step, and `--fallback error|warn|off` controls how references with a fallback are treated.
