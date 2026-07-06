# Contributing to sugarcube

Thanks for your interest in contributing!

Sugarcube is in active development toward a 1.0 release. The best ways to help right now:

- **Report bugs** — open an issue with reproduction steps
- **Improve docs** — typos, clarifications, and examples are always welcome
- **Share feedback** — what's confusing? What's missing?

For feature work, please open an issue first to discuss. This is a solo project (for now), so I'm selective about scope (for now).

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
```

### Packages

| Package              | Path            | Description                         |
| -------------------- | --------------- | ----------------------------------- |
| `@sugarcube-sh/core` | `packages/core` | Token processing and CSS generation |
| `@sugarcube-sh/cli`  | `packages/cli`  | Command-line interface              |
| `@sugarcube-sh/vite` | `packages/vite` | Vite plugin with HMR                |
| `apps/www`           | `apps/www`      | Marketing & documentation site      |

### Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `pnpm build`      | Build all packages               |
| `pnpm test`       | Run all tests                    |
| `pnpm dev`        | Run dev mode (core + vite)       |
| `pnpm dev:www`    | Run the docs site locally        |
| `pnpm lint`       | Lint with Oxlint                 |
| `pnpm lint:fix`   | Fix linting errors with Oxlint   |
| `pnpm fmt`        | Format code with Oxfmt           |
| `pnpm fmt:check`  | Check formatting with Oxfmt      |
| `pnpm type-check` | Run TypeScript checks            |

### Code Style

We use [Oxlint](https://oxlint.dev/) for linting. Run before submitting:

```bash
pnpm lint
```

We use [Oxfmt](https://oxfmt.dev/) for formatting. Run before submitting:

```bash
pnpm fmt
```

## Questions?

Open an [issue](https://github.com/sugarcube-sh/sugarcube/issues).
