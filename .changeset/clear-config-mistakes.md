---
"@sugarcube-sh/cli": patch
"@sugarcube-sh/vite": patch
---

Fixes a problem where a mistake in `sugarcube.config.ts` was reported as "Invalid input" without saying which setting was wrong. Each mistake now gets its own line naming the setting and what it must be.
