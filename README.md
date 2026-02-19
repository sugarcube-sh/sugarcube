<h1 align="center">sugarcube</h1>

<p align="center">
  <strong>Design tokens → CSS variables, utility classes, & components</strong><br/>
  Build on the W3C standard. No runtime. No lock-in.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/v/@sugarcube-sh/core.svg" alt="Latest Release"></a>
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/dt/@sugarcube-sh/core.svg" alt="Total Downloads"></a>
  <a href="https://github.com/sugarcube-sh/sugarcube/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-see%20LICENSE-blue" alt="License"></a>
</p>

---

Sugarcube processes [W3C DTCG](https://www.designtokens.org/) design tokens into CSS variables, utility classes, and component styles. Change a token, your CSS updates. Use Vite for hot reloading, or generate static files with the CLI.

## Contents

- [Why sugarcube?](#why-sugarcube)
- [Quick start](#quick-start)
- [What you get](#what-you-get)
- [Documentation](#documentation)
- [Packages](#packages)

## Why sugarcube?

### It's just CSS

Sugarcube generates plain CSS files. No runtime, no framework coupling, no proprietary syntax in your markup. You can stop using sugarcube tomorrow and keep all your CSS.

### Tokens are more than values

CSS variables store values. Tokens store values plus metadata — descriptions, types, deprecation flags, relationships between values and so on. That metadata can power tooling: linting, documentation generation, design-tool sync.

### Components without styling framework lock-in

Unlike component libraries that require a specific styling framework, sugarcube component styles are just CSS. 

### The standard, not a proprietary format

The DTCG token standard is what the ecosystem is converging on. Sugarcube reads DTCG directly. Learn one format, use any tool. If you outgrow sugarcube, your tokens work with whatever comes next.

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

If you install the CLI as a dev dependency, you can use the `sugarcube` command in your npm scripts:

```json
{
  "scripts": {
    "tokens:generate": "sugarcube generate",
    "tokens:validate": "sugarcube validate"
  }
}
```

See the [CLI commands](/docs/reference/cli-commands) for more details.

## What you get

| Layer | What it does | Optional? |
|-------|--------------|-----------|
| **CSS variables** | Every token becomes a `--variable` | Core feature |
| **Utility classes** | `.color-primary`, `.space-m`, etc. | Yes |
| **CUBE CSS** | A methodology for clean, scalable CSS | Yes |
| **Components** | UI components | Yes |

Use all of it, or just the variables. Sugarcube is designed to be adopted incrementally.

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
