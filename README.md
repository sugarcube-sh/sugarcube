<h1 align="center">sugarcube</h1>

<p align="center">
  <strong>Design tokens → CSS variables → utility classes</strong><br/>
  Build on the W3C standard. No runtime. No lock-in.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/v/@sugarcube-sh/core.svg" alt="Latest Release"></a>
  <a href="https://www.npmjs.com/package/@sugarcube-sh/core"><img src="https://img.shields.io/npm/dt/@sugarcube-sh/core.svg" alt="Total Downloads"></a>
  <a href="https://github.com/sugarcube-sh/sugarcube/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-see%20LICENSE-blue" alt="License"></a>
</p>

---

Sugarcube processes [W3C DTCG](https://www.designtokens.org/) design tokens into CSS variables and utility classes. Change a token, your CSS updates. Use Vite for hot reloading, or generate static files with the CLI.

## Why sugarcube?

**Tokens are source. CSS is output.** Your Tailwind config, your stylesheets, your CSS variables — these are all implementations of design decisions. Tokens are those decisions in a portable, tool-agnostic format. When your source is a standard, you can change your tools without rewriting your design system.

**The DTCG got the format right.** DTCG is what the ecosystem is converging on. Figma Variables, Tokens Studio, Style Dictionary—they all speak it. Sugarcube reads DTCG directly. Learn one format, use any tool.

**One source, multiple outputs.** Tokens become CSS variables. Variables become utility classes. Change one token, everything downstream updates. No parallel definitions to maintain.

**Plain CSS, no runtime.** Sugarcube generates `.css` files at build time. No framework dependency, no bundle size, no proprietary syntax in your markup. Stop using sugarcube tomorrow; keep all your CSS.

## Quick start

```bash
npx @sugarcube-sh/cli init
```

This detects your project, adds a token starter kit (or uses your existing tokens), and generates CSS.

For Vite projects, the plugin provides hot reloading when tokens change:

```ts
// vite.config.ts
import sugarcube from '@sugarcube-sh/vite';

export default {
  plugins: [sugarcube()]
};
```

## What you get

| Layer | What it does | Optional? |
|-------|--------------|-----------|
| **CSS variables** | Every token becomes a `--variable` | Core feature |
| **Utility classes** | `.color-primary`, `.space-m`, etc. | Yes |
| **CUBE CSS** | Architecture for organizing styles | Yes |
| **Components** | Layout primitives and UI components | Yes |

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
