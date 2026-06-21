---
"@sugarcube-sh/core": patch
---

fix: $resolvedValue for a chained reference was using whichever permutation was flattened last. This scopes resolution to the referrer's perm:N context so a chain stays in its own permutation.
