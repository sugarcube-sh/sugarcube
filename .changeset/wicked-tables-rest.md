---
"@sugarcube-sh/cli": patch
---

perf(watch): make `generate --watch` incremental — value-only token edits reuse cached utilities and markup edits reuse a persisted UnoCSS generator (~3–12× faster per change)
