---
"@sugarcube-sh/core": patch
---

Add private sets. Mark a set or a source in your resolver with `$extensions.sh.sugarcube.emit: false` and its tokens still resolve — so other tokens can reference them — but no CSS variables are emitted for them. References to a private token are inlined to its resolved value. Handy for keeping internal scaffolding, like a raw colour palette, out of your published CSS.
