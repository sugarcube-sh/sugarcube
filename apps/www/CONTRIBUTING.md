# Contributing to apps/www

## Run the site

```bash
pnpm dev            # site on :4321
pnpm dev:debug      # same, plus verbose token-pipeline logs
```

## Develop the Studio UI live inside the site

Studio loads in the site's DevTools dock from a prebuilt bundle — no HMR. To
edit Studio's source and see it update live, run two terminals:

```bash
# terminal 1 — Studio's own dev server
pnpm --filter @sugarcube-sh/studio dev      # :5173

# terminal 2 — the site, pointed at that dev server
pnpm dev:studio
```

Open the site, open the DevTools dock → Studio. Edits to `packages/studio/src/**`
now hot-reload in the dock, with the site's real tokens.

### What `dev:studio` does

Sets `SUGARCUBE_STUDIO=true`, which:

- tells `studio()` **not** to serve its prebuilt bundle (`serveStatic: false`), and
- proxies `/__studio/` to Studio's dev server on :5173.

The dock stays on this origin, so its data connection is unaffected — only the
files come from the live server. If Studio's dev server isn't running on :5173,
the dock won't load.

Note: `SUGARCUBE_STUDIO=false` in `.env` is a **separate** switch for the
(commented-out) embedded `<sugarcube-studio>` block on the home page. Same name,
different job — the proxy only reads the shell value set by `dev:studio`.
