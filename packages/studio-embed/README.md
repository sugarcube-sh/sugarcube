# @sugarcube-sh/studio-embed

Framework-agnostic `<sugarcube-studio>` web component for embedding Studio
in a deployed page.

Renders Studio in an iframe and bridges postMessage between the iframe
and host for CSS updates and PR submissions.

## Usage

Add a build step that generates a snapshot and copies the Studio assets
into your framework's static-assets directory. Example:

```bash
sugarcube studio build --out public/studio
```

This writes `snapshot.json` (resolved tokens + panel config), `index.html`,
`assets/`, and `embed.js`. Your framework copies everything under
`public/` to the deploy root as part of its normal build,
so the files end up served at `/studio/*` on your deployed site.

Include the embed in whichever template should show Studio. Placing it
in a root layout obviously scopes it to the whole site; placing it in a single page template scopes
it to just that page. Typically gated to staging only via an env var so
it doesn't ship to production. But that's up to you.

```html
<script type="module" src="/studio/embed.js"></script>
<sugarcube-studio src="/studio/" snapshot="/studio/snapshot.json"></sugarcube-studio>
```

No separate hosting, no CDN — Studio ships with your site's normal deploy.

## Local dev

For developing this web component itself inside this monorepo, `apps/www`
uses a small sirv middleware in its Astro config to serve the SPA at
`/__studio/`. That's a dev convenience for our workflow, not something
consumers need.
