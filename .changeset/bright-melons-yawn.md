---
"@sugarcube-sh/core": patch
---

### Modifier Output API

Modifier selector/atRule output is now opt-in via `$extensions`. Modifiers without an extension output flat (default context only to `:root`).

**Breaking Change:** Modifiers no longer automatically generate `[data-*]` selectors. Add `selector` or `atRule` extension for multi-context output:

```json
{
  "type": "modifier",
  "name": "theme",
  "$extensions": {
    "sh.sugarcube": {
      "selector": "[data-theme=\"{context}\"]"
    }
  }
}
```

Or for media query wrapping:

```json
{
  "$extensions": {
    "sh.sugarcube": {
      "atRule": "@media (prefers-color-scheme: {context})"
    }
  }
}
```

The `{context}` placeholder is replaced with the context name (e.g., `dark`).

**Backwards compatibility:** `prefersColorScheme: true` still works (converted to atRule internally).

**Migration help:** If you have a modifier with multiple contexts but no extension, you'll now see a warning explaining which contexts will be skipped and how to fix it.

### Removed Dead Config Options

- Removed `output.themeAttribute` (was unused - attributes auto-derive from modifier names)
- Removed `output.defaultContext` (was unused - default comes from resolver)
- Removed `contextStrategy` field from `ModifierMeta` type (replaced by `selector`/`atRule`)
