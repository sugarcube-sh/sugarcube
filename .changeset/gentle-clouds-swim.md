---
"@sugarcube-sh/vite": patch
---

Fix HMR not triggering for token file changes when the `resolver` config option is specified with a relative path prefix (e.g., `./tokens/...`). The token watcher now resolves the resolver path to an absolute path before matching against Vite's watcher events.
