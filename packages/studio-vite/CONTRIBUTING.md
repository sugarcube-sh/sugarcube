# Contributing to @sugarcube-sh/studio-vite

One file, `src/index.ts`, in three parts: the sugarcube plugin's context adapted
to Studio's token source, the plugin that captures that context at
`configResolved`, and the default export, which mounts a devframes hub with the
Studio definition and the page script. There are no options: the hub is the one
host this package provides. The Studio dock reads whatever the sugarcube plugin
loaded; a save writes the files through `writeOpsToDisk`; a disk change comes
back through the plugin's own watcher.

To run Studio's own dev server against the demo instead, work in
`packages/studio` (`pnpm dev` there); this package is for a host app's config.

Tests: `pnpm test` here runs `tests/index.test.ts` against a fake plugin
context. Remember to rebuild (`pnpm build`) after changing the source; the host
app loads `dist`.
