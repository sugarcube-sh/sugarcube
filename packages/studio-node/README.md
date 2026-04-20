# @sugarcube-sh/studio-node

Standalone host for sugarcube's Studio.

## What this will be

A framework-agnostic Node host for Studio. Runs its own HTTP server (no Vite,
no dev-server integration required). Will likely reuse `@vitejs/devtools-rpc` in standalone
mode for the RPC transport, plus `sirv` for serving the built Studio SPA.