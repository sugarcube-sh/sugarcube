---
"@sugarcube-sh/vite": patch
---

Adds `sources`, `permutations` and `defaultContext` to the plugin context, so a tool sharing the dev server can read the token files the plugin already loaded instead of loading them again. Also fixes the token directory being cut short on Windows.
