---
"@sugarcube-sh/cli": patch
---

Fix `lint` and `analyze` missing your CSS when you use the `content` option.

Setting `content` so `generate` could find your templates used to stop `lint` and `analyze` reading stylesheets they'd found before. If those templates were a format they can't read (`.heex`, `.jsx`, …), they scanned nothing: `lint` reported a clean project, and `analyze unused` marked tokens unused while your CSS was using them.

`content` now adds to the scan instead of replacing it. Both commands always read CSS under the directory you run from, plus anywhere `content` points. Utility generation is unchanged.

If they find no stylesheets, they say so and list where they looked. They also warn when they only reached *part* of your CSS — e.g. generated output outside the scan — without reading that folder for you:

```
Didn't read 255 stylesheets in ../css

Tokens used only there appear unused. Add the folder to content.
```

`lint` stays quiet when you pass an explicit path. The partial-scan check now understands per-permutation output paths, so it finds the folder your tokens actually go in and excludes sugarcube's own generated variables from the scan.

`lint` exits `1` when it found no stylesheets (was `0`, so a misconfigured `content` could green CI). A partial scan still exits `0` with a warning; `analyze` always exits `0`.

Also: `lint` reads `<style>` blocks in `.htm` as well as `.html`, and its help now mentions directory paths (`sugarcube lint ../css`) (which it was missing before).
