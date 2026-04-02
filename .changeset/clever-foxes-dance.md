---
"@sugarcube-sh/core": patch
---

### DTCG 2025.10 Format Module support

Thanks @binyamin for raising this issue.

Adds support for the remaining DTCG 2025.10 Format Module features:

- **`$root`** — root tokens in groups (spec 6.2)
- **`$extends`** — group inheritance via deep merge (spec 6.4)
- **`$ref`** — JSON Pointer references for tokens and groups (spec 6.6.2)

`$ref` references are normalised to curly brace format before flattening. `$extends` performs a deep merge where local tokens override inherited ones at the same path. Both support circular reference detection.

Closes #57
