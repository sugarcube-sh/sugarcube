---
"@sugarcube-sh/cli": minor
---

`generate --watch` now runs on sugarcube's new engine. With it come several improvements: it rebuilds as soon as you save, keeps watching through broken files and shows each problem the way `generate` does. It also picks up changes to `sugarcube.config.ts`, instead of requiring a restart.
