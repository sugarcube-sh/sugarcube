---
"@sugarcube-sh/core": patch
---

Sanitize whitespace in token paths when generating CSS variable names. Group/token names containing spaces (e.g. `"acid green"` per DTCG §6.10.1, or accidental trailing whitespace like `"color "`) now produce valid CSS — internal whitespace collapses to `-`, and leading/trailing whitespace is trimmed. Names with leading or trailing whitespace also emit a non-blocking pipeline warning so the typo surfaces in the source. Fixes #91. Thanks @ajguyot.
