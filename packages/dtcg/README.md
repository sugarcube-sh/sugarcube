# @sugarcube-sh/dtcg

<p>
  <a href="https://www.npmjs.com/package/@sugarcube-sh/dtcg"><img src="https://img.shields.io/npm/v/@sugarcube-sh/dtcg.svg" alt="Latest Release"></a>
  <a href="https://www.npmjs.com/package/@sugarcube-sh/dtcg"><img src="https://img.shields.io/npm/dt/@sugarcube-sh/dtcg.svg" alt="Total Downloads"></a>
  <a href="https://github.com/sugarcube-sh/sugarcube/blob/main/packages/dtcg/LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
</p>

`@sugarcube-sh/dtcg` is a TypeScript library that reads DTCG design tokens and resolver files. Use it to build your own token-related tools.

## Install

```bash
npm install @sugarcube-sh/dtcg
```

Requires Node 22.14 or later.

## Usage

```ts
import { read } from "@sugarcube-sh/dtcg/node";

const tokens = await read("tokens.resolver.json");

for (const problem of tokens.diagnostics) {
  console.log(`${problem.span?.file}:${problem.span?.start.line} ${problem.message}`);
}
// color.json:16 `color.bleu.500` does not exist
```

## Documentation

- [Get started](https://sugarcube.sh/dtcg/docs/getting-started/introduction/)
- [Guides](https://sugarcube.sh/dtcg/docs/guides/work-with-permutations/)
- [Concepts](https://sugarcube.sh/dtcg/docs/concepts/how-a-read-works/)
- [Reference](https://sugarcube.sh/dtcg/docs/reference/overview/)

## Acknowledgments

Thanks to [Binyamin Green](https://github.com/binyamin) and [Scott Riley](https://scott.is/), who each, separately, gave me the idea for a lower-level DTCG library.

## License

MIT. See [LICENSE.md](./LICENSE.md).
