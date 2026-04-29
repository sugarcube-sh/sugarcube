---
"@sugarcube-sh/core": patch
---

Allow modifier contexts to reference sets via `#/sets/*` (DTCG §4.1.5.1, Example 4). The referenced set's sources are inlined into the modifier context, so a context like `dark: [{ "$ref": "#/sets/darkColors" }]` now resolves correctly instead of failing. Combining a set ref with extending properties (spec §4.2.2) in the same source object is rejected with a clear error, since shallow-merge has no single target when the ref expands to multiple sources. Fixes #92 - thanks @ajguyot for the report.
