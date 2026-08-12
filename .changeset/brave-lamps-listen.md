---
"@sugarcube-sh/cli": patch
---

Fix `lint` and `analyze` missing your CSS when you use the `content` option.

Setting `content` so `generate` could find your templates used to stop `lint` and `analyze` reading stylesheets they had been reading perfectly well before. If your templates were a format those commands can't read, like `.heex` or `.jsx`, they ended up reading nothing at all: `lint` reported a clean project without checking it, and `analyze unused` listed tokens as unused while your CSS was actually using them.

`content` now adds to what those two commands look at instead of replacing it. They always read the CSS in the directory you run from and below it, plus anywhere `content` points. Utility generation is unchanged.

If they still find no stylesheets, they now tell you and explain where they looked, rather than reporting a clean result. That matters most for `analyze unused`, where an empty scan makes every token look safe to delete.

They also warn when they only read *part* of your CSS, which is the harder case to spot, because a scan that finds a handful of files looks like one that worked. Sugarcube knows where it writes your generated CSS, so when that folder sits outside everything the scan reached, both commands count the stylesheets there and tell you:

```
Didn't read 255 stylesheets in ../css

Tokens used only there appear unused. Add the folder to content.
```

Nothing extra gets read on your behalf — sugarcube doesn't assume CSS sitting near its output belongs in the scan, it just points out that it's there. Add the folder to `content` and the warning goes away. `lint` stays quiet when you give it an explicit path, since that's a deliberate choice about what to check.

That check now understands per-permutation output paths. If your permutations each set their own `path` and you never set `variables.path`, sugarcube was looking in the default location nothing gets written to, so it missed the folder your tokens actually go in, and worse, didn't exclude your generated variables file from the scan. Both commands could end up reading sugarcube's own output and counting it as usage.

`lint` now exits `1` when it found no stylesheets at all. Previously it printed a warning and exited `0`, so a misconfigured `content` gave you a green CI build off a run that read nothing. Reading only *part* of your CSS still exits `0` - you get the warning, not a failure - and `analyze` still always exits `0`, because it reports rather than judges.

Two smaller things: `lint` now reads `<style>` blocks in `.htm` files as well as `.html`, and its help text mentions that you can point it at a directory, as in `sugarcube lint ../css`.
