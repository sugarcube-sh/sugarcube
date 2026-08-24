# @sugarcube-sh/studio-node

Generic host for sugarcube's Studio.

Will eventually runs its own HTTP server (no Vite, no dev-server integration required). Will likely reuse `@vitejs/devtools-rpc` in standalone mode for the RPC transport, plus `sirv` for serving the built Studio SPA.
