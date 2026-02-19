<h1 align="center">sugarcube</h1>

<p align="center">
  <strong>Design tokens → CSS variables, utility classes, & components</strong><br/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/v/@sugarcube-sh/core.svg" alt="Latest Release"></a>
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/dt/@sugarcube-sh/core.svg" alt="Total Downloads"></a>
  <a href="https://github.com/sugarcube-sh/sugarcube/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-see%20LICENSE-blue" alt="License"></a>
</p>

---

Sugarcube processes [W3C DTCG](https://www.designtokens.org/) design tokens into CSS variables, utility classes, and component styles. Change a token, your CSS updates. Use Vite for hot reloading, or generate static files with the CLI.

## Contents

- [Quick start](#quick-start)
- [What you get](#what-you-get)
- [Documentation](#documentation)
- [Packages](#packages)

## Quick start

```bash
npx @sugarcube-sh/cli init
```

This detects your project, adds a token starter kit (or uses your existing tokens), generates CSS, and installs either the Vite plugin or the CLI (pass `--skip-deps` for neither).

For Vite projects, the plugin provides hot reloading when tokens change:

```ts
// vite.config.ts
import sugarcube from '@sugarcube-sh/vite';

export default {
  plugins: [sugarcube()]
};
```

For non-Vite projects, the CLI provides a `generate` command to generate CSS:

```bash
npx @sugarcube-sh/cli generate
```

If the CLI is installed as a dev dependency, you can use the `sugarcube` command in your npm scripts:

```json
{
  "scripts": {
    "styles:generate": "sugarcube generate",
    "tokens:validate": "sugarcube validate"
  }
}
```

## Documentation

[sugarcube.sh/docs](https://sugarcube.sh/docs) — Full setup guide, configuration reference, and component registry.

## Packages

| Package | Description |
|---------|-------------|
| [`@sugarcube-sh/cli`](https://npmx.dev/package/@sugarcube-sh/cli) | CLI for sugarcube |
| [`@sugarcube-sh/vite`](https://npmx.dev/package/@sugarcube-sh/vite) | Vite plugin for sugarcube |
| [`@sugarcube-sh/core`](https://npmx.dev/package/@sugarcube-sh/core) | Core functionality for sugarcube |

## License

See [LICENSE.md](./LICENSE.md) for terms.
