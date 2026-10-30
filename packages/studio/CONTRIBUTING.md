# Working on studio

## Try it on its own

```bash
cd packages/studio
pnpm dev
```

Open http://localhost:5173/. Studio edits the example tokens in `demo/`. Change one of those files
and studio updates.

## Try it on the website

```bash
cd packages/studio
pnpm build
cd ../../apps/www
pnpm dev
```

Studio appears on every page of the site and edits the site's own tokens. See
[apps/www/CONTRIBUTING.md](../../apps/www/CONTRIBUTING.md).

## After you change studio

```bash
pnpm build
```

## Tests

```bash
pnpm test
```
