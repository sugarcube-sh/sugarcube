---
"@sugarcube-sh/cli": minor
---

`generate` and `validate` now run on sugarcube's new engine.

When something's wrong with your tokens, both commands print one problem per line, each starting with the file, line and column, which most terminals and editors let you click. Where there's a likely fix the message suggests one ("did you mean `color.ink`?"), and a problem that only affects some of your themes says which ones.

`validate` now checks the same tokens `generate` would build, using your config; before, any problem in them came out as "No path specified".

A mistake in `sugarcube.config.ts` or in a flag is now reported as a config mistake rather than "An unexpected error occurred", and `lint` and `analyze` no longer call every config problem "No design tokens found".
