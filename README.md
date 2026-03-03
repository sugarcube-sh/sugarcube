<h1 align="center">sugarcube</h1>

<p align="center">
  <strong>Design tokens in, CSS & components out</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/v/@sugarcube-sh/core.svg" alt="Latest Release"></a>
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/dt/@sugarcube-sh/core.svg" alt="Total Downloads"></a>
  <a href="https://github.com/sugarcube-sh/sugarcube/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-see%20LICENSE-blue" alt="License"></a>
</p>

---

Sugarcube is a tool for building front ends on [DTCG design tokens](https://www.designtokens.org/). It connects your tokens to CSS variables, utility classes, CUBE architecture, and copy-to-own components — via the Vite plugin or CLI.

## Quick start

```bash
npx @sugarcube-sh/cli init
```

This walks you through setup: starter tokens, CUBE CSS, components, and Vite plugin. The CLI is installed locally, so you can use `sugarcube` going forward.

**With the Vite plugin:**

```ts
// vite.config.ts
import sugarcube from "@sugarcube-sh/vite";

export default {
  plugins: [sugarcube()],
};
```

```ts
import "virtual:sugarcube.css";
```

**Without the Vite plugin:**

```bash
sugarcube generate
```

Or add it to your npm scripts:

```json
{
  "scripts": {
    "styles:generate": "sugarcube generate",
    "styles:generate:watch": "sugarcube generate --watch",
    "tokens:validate": "sugarcube validate"
  }
}
```

## Documentation

[sugarcube.sh/docs](https://sugarcube.sh/docs)

## Packages

| Package | Description |
|---------|-------------|
| [`@sugarcube-sh/cli`](https://npmx.dev/package/@sugarcube-sh/cli) | CLI for initialization, generation, and components |
| [`@sugarcube-sh/vite`](https://npmx.dev/package/@sugarcube-sh/vite) | Vite plugin with HMR |
| [`@sugarcube-sh/core`](https://npmx.dev/package/@sugarcube-sh/core) | Core token processing |

## License

See [LICENSE.md](./LICENSE.md).
