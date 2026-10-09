---
"@sugarcube-sh/cli": minor
---

`generate --watch` now rebuilds as soon as you save, keeps watching when a token file is broken (even at start), shows each problem with its file, line and column, picks up changes to `sugarcube.config.ts`, and watches token files you add to your resolver.
