---
"@sugarcube-sh/core": patch
---

fix: preserve group-level $type inheritance in modifier contexts. Thanks @leannerenard.

Modifier override files using group-level $type (e.g., `{ "color": { "$type": "color", "primary": { "$value": "#fff" } } }`) now correctly generate CSS. Previously, the group structure was lost during context processing, causing tokens to be silently filtered out.

Also adds validation to error when tokens have literal values but no $type (either explicit or inherited), rather than silently producing no output.
