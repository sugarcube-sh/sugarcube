---
"@sugarcube-sh/vite": patch
---

Tidier plugin context for tools that share the dev server (like studio).

- When one of these tools asks the plugin to reload the tokens, the page now updates too. Before, it only updated when you saved a token file.
- The context now says why a token load failed, lets a tool stop listening for reloads, and exports the plugin's name so a tool can find the plugin without typing it out.
- Removed three methods that nothing called, and the jsonc-parser dependency.