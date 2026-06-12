---
"@sugarcube-sh/core": patch
---

fix: strip `$root` from CSS variable names when a `variableName` callback is set

A `$root` token's path (e.g. `blue.$root`) is meant to emit under its group path (`--blue`). The `$root` segment is a reference-only disambiguator and must never reach an identifier. The default and `prefix` naming paths already stripped it, but a custom `variableName` callback received the raw path including `.$root`, producing names like `--blue_$root`. That isn't a valid CSS custom property (`$` is not a valid identifier character), so browsers drop the declaration and the token's value silently disappears.

The strip now happens in the resolver, before the `variableName` callback runs, so every naming route - default, `prefix`, and `variableName` (including Studio, which builds names through the same resolver) - honours the invariant. Alias references keep resolving because the lookup is still the full `$path`.
