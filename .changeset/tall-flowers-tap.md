---
"@sugarcube-sh/vite": patch
---

Fix overlapping dev-server rebuilds (token reloads are now debounced and single-flighted) and speed up CSS invalidation with a keyed module lookup.
