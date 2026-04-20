# @sugarcube-sh/studio-vite

Vite plugin that surfaces Sugarcube Studio as a DevTools dock in local dev.

Registers the dock via `@vitejs/devtools-kit`, serves the Studio SPA inside
it, and wires RPC + shared state for editing tokens live against the
running Vite dev server. Requires `@sugarcube-sh/vite` to be installed —
Studio reads resolved tokens from that plugin's context.