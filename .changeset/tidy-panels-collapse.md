---
"@sugarcube-sh/core": minor
---

**Breaking:** collapse the Studio panel config.

Five binding types become four, and a colour scale is now described by where its palettes
are rather than by a grid of assumptions about them.

`color` and `preset` produced the same row and differed only in where their choices came
from. They are now one `alias` binding that says that explicitly. `scale-linked` is renamed
`link` — its value is a boolean and its control a switch, so it has nothing structurally in
common with `scale`.

An alias says where its choices come from with exactly one of `options` (the set itself) or
`from` (a source declared elsewhere in `studio` config). Either may be inherited from the
section. Nothing is inferred from a token's `$type` or the shape of its value, so a binding
supplying neither — or both — fails at config load, naming the section and the token.

`colorScale` no longer assumes every palette shares a prefix or holds the same steps. Each
palette is a full token path, and its steps are read from the tokens, so palettes of
different lengths work and no swatch is offered for a token that doesn't exist. `steps` is
now an optional filter over what's found, and `prefix`, `white` and `black` are gone — a
project wanting white or black declares them as a palette like any other.

### Migration

```diff
- { type: "color", token: "color.surface.*" }
+ { type: "alias", token: "color.surface.*", from: "colorScale" }

- { type: "preset", token: "panel.radius", options: "radius.*", label: "Panels" }
+ { type: "alias", token: "panel.radius", options: "radius.*", label: "Panels" }

- { type: "scale-linked", token: "container.*", scalesWith: "size.step.*" }
+ { type: "link", token: "container.*", scalesWith: "size.step.*" }
```

```diff
  colorScale: {
-   prefix: "color",
-   palettes: ["neutral", "pink"],
-   steps: ["50", "100", "500", "950"],
-   white: "color.white",
-   black: "color.black",
+   palettes: ["color.neutral", "color.pink"],
+   steps: ["50", "100", "500", "950"],   // optional now — omit to offer every step found
  }
```

`from` and `options` can move up to the section so they aren't repeated:

```ts
{
  title: "Corners",
  options: "radius.*",
  bindings: [
    { type: "alias", token: "panel.radius", label: "Panels" },
    { type: "alias", token: "form-control.radius", label: "Form controls" },
  ],
}
```

Glob bindings gain two optional fields: `labels`, a map keyed by each match's last segment,
and `only`, which both filters the matches and orders them.

`scale` and `palette-swap` are unchanged.
