---
"@sugarcube-sh/core": patch
---

Fix `$root` tokens so they produce clean CSS variables.

If you had a group like `blue` with a `$root` child for the base colour plus variants (`50`, `100`, etc.), the base colour was coming out as `--blue-$root` — not valid CSS. Now it simply becomes `--blue`, which is what you'd expect. References like `{blue.$root}` compile to `var(--blue)` too.

```json
{
  "blue": {
    "$type": "color",
    "$root": { "$value": "#0000FF" },
    "50": { "$value": "#ADD8E6" }
  }
}
```

```css
/* Before */
--blue-$root: #0000FF;
--blue-50: #ADD8E6;

/* After */
--blue: #0000FF;
--blue-50: #ADD8E6;
```
