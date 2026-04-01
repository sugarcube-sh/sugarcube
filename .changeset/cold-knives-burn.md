---
"@sugarcube-sh/vite": patch
"@sugarcube-sh/core": patch
---

### Fix: config changes now hot-reload in the browser

Changes to `sugarcube.config.ts` (permutation selectors, transforms, utility config, etc.) now take effect via HMR without restarting the dev server.

Previously, config changes were detected but the browser never received the updated CSS. Two issues:

1. **Stale config** — `jiti` cached the config module between reloads, so the pipeline regenerated CSS from the old config values.
2. **Missing token reload** — config changes that affect permutations require re-running the full token pipeline, not just regenerating CSS from already-resolved tokens.
