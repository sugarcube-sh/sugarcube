# Developing Studio

Studio is the visual editor UI. Three ways to run it, all the same app over the same
devframe definition. Only where the files come from differs.

## From this package

```bash
pnpm dev
```

Open http://localhost:5173/. Vite serves the app at the root with HMR; devframe's bridge
answers at `/__studio/` against the demo tokens in `demo/`, and a change to one of those
files reloads Studio. See `src/dev/demo.ts`.

## Inside apps/www

The Vite plugin mounts a devframes hub in the site's dev server: Studio as a dock over the
site, editing the site's real tokens. Setup: see `apps/www/CONTRIBUTING.md`.

## From the command

```bash
sugarcube studio
```

Runs the same hub on its own port for any project, Vite or not, and prints the one script tag
a page adds to get the dock. See `packages/studio-node/src/hub.ts` and
`notes/studio/devframe-audit.md` for why it is a hub.

Whatever the host, run `pnpm build` in this package after changing `src/server/*` or the page
script: the adapters load Studio's built output.
