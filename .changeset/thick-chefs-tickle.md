---
"@sugarcube-sh/core": patch
---

- `loadTokens` returns `sources` (which files built each context, in order, with their text) and `defaultContext`.
- Groups now carry a `$sourcePath`, not only tokens.
- New `composeTrees` on the client entry: rebuild the trees from file text, no filesystem needed.
- `debounce` and `createCoalescedRunner` live here now, shared by the CLI and Vite plugin.
- No change to CSS output.
