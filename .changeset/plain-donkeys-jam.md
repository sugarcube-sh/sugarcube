---
"@sugarcube-sh/core": patch
---

fix: omit redundant `@media` blocks when a breakpoint resolves to the same value as the one before it. Thanks @aarongeorge for raising this!

Permutations that share an output file and selector are emitted as deltas. Until now every block was diffed against the first permutation in the file, so a wider breakpoint that resolved identically to a narrower one still got its own `@media` block restating the value. Because a `min-width` rule keeps applying as the screen gets wider, that block was pure redundancy.

Each block is now diffed against the value actually in effect at that point.