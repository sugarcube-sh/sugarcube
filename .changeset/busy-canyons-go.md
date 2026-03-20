---
"@sugarcube-sh/core": patch
---

Add `prefersColorScheme` extension for automatic theme switching

Modifiers can now use `@media (prefers-color-scheme)` queries instead of data attributes by adding `prefersColorScheme: true` to the modifier's `$extensions`:

```json
{
  "type": "modifier",
  "name": "theme",
  "default": "light",
  "contexts": {
    "light": [],
    "dark": [{ "$ref": "./dark.json" }]
  },
  "$extensions": {
    "sh.sugarcube": {
      "prefersColorScheme": true
    }
  }
}
```

This generates CSS that automatically follows the user's OS preference:

```css
:root {
  /* light values */
}
@media (prefers-color-scheme: dark) {
  :root {
    /* dark overrides */
  }
}
```

Validation ensures:

- Context names must be `light` and `dark` only
- Non-default contexts must have token sources (otherwise the media query would be empty)
