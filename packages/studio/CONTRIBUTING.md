# Developing Studio

Studio is the visual editor UI. Two ways to run it in dev.

## Sandbox

```bash
pnpm dev
```

Open http://localhost:5173/__studio/.

NB: Studio's own tokens have no `studio.panel` config yet, so the editing
panel is empty here - you get the shell (header, tabs, buttons) but not the
pickers.

## Inside apps/www

Runs studio in www's DevTools dock with www's real tokens, so every picker and
panel shows up. Setup: see `apps/www/CONTRIBUTING.md`.

## Why two ways?

We currently run studio two ways (sandbox vs proxied into www). Once studio's
package gets its own `studio.panel` demo config, the sandbox will show the full
UI and we can drop the www proxy.
