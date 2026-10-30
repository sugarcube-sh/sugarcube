# @sugarcube-sh/studio

Studio lets you change your design tokens in the browser and see your site change as you go.

NB. Studio is a work in progress and not yet ready for release/use.

## Two ways to use it

You can use studio on its own page, or as an overlay on top of your site. Each setup below covers both.

## With Vite

If your site uses sugarcube's Vite plugin, add studio beside it:

```js
import sugarcube from "@sugarcube-sh/vite";
import studio from "@sugarcube-sh/studio/vite";

export default {
    plugins: [sugarcube(), studio()],
};
```

Start your dev server. Studio appears on your pages (and on a page of its own at
`/__sugarcube/studio/`).

Vite adds studio to the HTML files it serves itself. If your pages are made by something else,
such as a site framework, add this to them yourself:

```html
<script type="module" src="/__sugarcube/embedded.js"></script>
```

## Without Vite

```js
import { serveStudio } from "@sugarcube-sh/studio/node";

await serveStudio();
```

Run it from your project's folder: studio reads `sugarcube.config.ts` from there.

This starts studio at http://localhost:2823. Open http://localhost:2823/__sugarcube/studio/ to use
it on a page of its own.

To have studio appear on your site's pages too, add this to them:

```html
<script type="module" src="http://localhost:2823/__sugarcube/embedded.js"></script>
```

## On a published site

```js
import { buildStudio } from "@sugarcube-sh/studio/node";

await buildStudio({ outDir: "dist" });
```

Run it from your project's folder, as above.

This writes studio as plain files into `dist`. Publish that folder at your site's root, and studio
opens at `/__sugarcube/studio/` on your site.

To have studio appear on your site's pages too, add this to them:

```html
<script type="module" src="/__sugarcube/embedded.js"></script>
```

### Saving

A published site has no dev server to write your files, so studio saves by opening a pull request
on GitHub, signed in as whoever is editing. To set that up:

1. Create a GitHub App for your site. Give it read and write access to contents and pull
   requests, and set its callback URL to `https://your-site.com/api/sugarcube-studio/callback`.

2. Tell studio which repository to save to, in `sugarcube.config.ts`:

   ```ts
   export default defineConfig({
       studio: {
           repository: "acme/site",
           app: "acme-studio",
       },
   });
   ```

   `app` is your GitHub App's name, so studio can link people to install it. Studio saves to the
   branch the site was built from.

3. Add the sign-in route to your site, at `/api/sugarcube-studio/`:

   ```ts
   import { signIn } from "@sugarcube-sh/studio/sign-in";

   export const { GET, POST } = signIn();
   ```

4. Set these on your host: `SUGARCUBE_STUDIO_GITHUB_CLIENT_ID` and
   `SUGARCUBE_STUDIO_GITHUB_CLIENT_SECRET` from your GitHub App, and `SUGARCUBE_STUDIO_SECRET`, any
   random string of at least 32 characters.

## Working on studio

See [CONTRIBUTING.md](./CONTRIBUTING.md).
