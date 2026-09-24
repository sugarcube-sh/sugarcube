---
"@sugarcube-sh/vite": patch
---

The plugin context (`getContext()` on the `sugarcube:api` plugin) now reports `sources`, the token files each context was built from with their text; `permutations`; and `defaultContext`. For tools that sit on top of the plugin. Also fixes the token directory being cut short on Windows paths.
