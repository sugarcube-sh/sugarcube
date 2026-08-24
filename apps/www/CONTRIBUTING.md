# Contributing to apps/www

## Run the site

```bash
pnpm dev
pnpm dev:debug      # for token-pipeline logs
```

## How to develop the Studio UI live inside the site

We dogfood Studio inside the site. Problem is, Studio's dev server runs on a
different port than the site, so we need to proxy Studio's dev server to the
site's DevTools dock.

To edit Studio's source and see it update live, you need to run two terminals:

```bash
pnpm --filter @sugarcube-sh/studio dev
pnpm dev:studio
```

### What `dev:studio` does

Sets `SUGARCUBE_STUDIO=true`, which:

- tells `studio()` **not** to serve its prebuilt bundle (`serveStatic: false`), and
- proxies `/__studio/` to Studio's dev server on :5173.
