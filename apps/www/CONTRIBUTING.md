# Working on the website

## Run the site

```bash
pnpm dev
```

To also see what sugarcube is doing as it reads the tokens:

```bash
pnpm dev:debug
```

## Studio

While the site runs, studio appears on every page. To open it on a page of its own, go to
http://localhost:4321/__sugarcube/studio/ (or the port the dev server prints).

If you've changed studio, run `pnpm build` in `packages/studio` first.
