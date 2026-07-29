---
"@sugarcube-sh/cli": patch
---

Speed up `generate --watch`: markup is read in parallel, regenerations no longer overlap, and token vs. markup edits only rebuild what changed.
