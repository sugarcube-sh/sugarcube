# Contributing to @sugarcube-sh/studio-vite

## `serveStatic` option

By default the plugin serves the built Studio SPA at `/__studio/`. Pass
`serveStatic: false` when the host app serves that path itself (e.g. proxying
`/__studio/` to Studio's dev server for HMR).

```js
studio({ serveStatic: false })
```

When off, the plugin still registers the dock (still pointing at `/__studio/`), 
it just stops hosting the files there. See `apps/www/CONTRIBUTING.md` for the
full live-dev setup that uses this.

Remember to rebuild (`pnpm build`) after changing the source.
