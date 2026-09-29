---
"@sugarcube-sh/core": patch
---

Removed the deprecated `fluidDimension` token type. A token typed `fluidDimension` is now an error. Use `$type: "dimension"` with the fluid range in `$extensions["sh.sugarcube"].fluid`; the error shows the replacement.
