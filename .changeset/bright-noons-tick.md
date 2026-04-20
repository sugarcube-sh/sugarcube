---
"@sugarcube-sh/cli": patch
"@sugarcube-sh/core": patch
---

**`@sugarcube-sh/cli`**

- Bump `chokidar` to `^5.0.0`. v4.0.3 was published without provenance, causing `pnpm install` to fail silently under `trustPolicy: no-downgrade`. ([#75](https://github.com/sugarcube-sh/sugarcube/issues/75))
- Surface package-manager stderr when `sugarcube init` fails to install dependencies. Previously the underlying error (e.g. pnpm trust-policy rejections, network failures) was swallowed and replaced with a generic message, making install failures hard to diagnose.
- Raise minimum Node version to `>=20.19.0`. Node 18 has been EOL since April 2025 and the effective floor was already 20.19 via transitive deps.

**`@sugarcube-sh/core`**

- Raise minimum Node version to `>=20.19.0` to match the CLI.
