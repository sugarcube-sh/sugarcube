---
"@sugarcube-sh/cli": patch
---

Fix `lint` and `analyze` missing your CSS when you use the `content` option.

Setting `content` so `generate` could find your templates used to stop `lint` and `analyze` reading stylesheets they had been reading perfectly well before. If your templates were a format those commands can't read, like `.heex` or `.jsx`, they ended up reading nothing at all: `lint` reported a clean project without checking it, and `analyze unused` listed tokens as unused while your CSS was actually using them.

`content` now adds to what those two commands look at instead of replacing it. They always read the CSS in the directory you run from and below it, plus anywhere `content` points. Utility generation is unchanged.

If they still find no stylesheets, they now tell you and explain where they looked, rather than reporting a clean result. That matters most for `analyze unused`, where an empty scan makes every token look safe to delete.

Two smaller things: `lint` now reads `<style>` blocks in `.htm` files as well as `.html`, and its help text mentions that you can point it at a directory, as in `sugarcube lint ../css`.
