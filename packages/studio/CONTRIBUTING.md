# Developing Studio

Studio is the visual editor UI. Two ways to run it in dev.

## 1. Sandbox

```bash
pnpm dev
```

Open http://localhost:5173/__studio/. Edit anything under `src/` and it hot-reloads.

NB: Studio's own tokens have no `studio.panel` config yet, so the editing
panel is empty here - you get the shell (header, tabs, buttons) but not the
pickers.

## 2. Inside apps/www

Runs Studio in www's DevTools dock with www's real tokens, so every picker and
panel shows up - and still hot-reloads. Use this when you need the populated
editor. Setup: see `apps/www/CONTRIBUTING.md`.

## Why two ways?

We currently run Studio two ways (sandbox vs proxied into www). Once Studio's
package gets its own `studio.panel` demo config, the sandbox will show the full
UI and we can drop the www proxy. Until then both exist.
