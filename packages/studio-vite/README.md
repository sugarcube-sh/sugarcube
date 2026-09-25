# @sugarcube-sh/studio-vite

Under construction. Not supported for external use yet.

Studio for a project that already runs the sugarcube Vite plugin. One line in
the Vite config mounts a devframes hub over the page, with Studio as a dock and
at `/__studio/`, reading the tokens the plugin already loaded rather than
loading them again. Edits reach the page as CSS over the in-page channel.

```js
import studio from "@sugarcube-sh/studio-vite";

export default {
    plugins: [sugarcube(), studio()],
};
```

For monorepo development, see [CONTRIBUTING.md](./CONTRIBUTING.md).
