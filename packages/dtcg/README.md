# @sugarcube-sh/dtcg

Read design tokens written in the [DTCG format](https://www.designtokens.org/), check them, and export them again.

Currently the API is types and stubs only. Every function throws "not implemented yet".

## Proposed entry points

| Import from | Holds | Runs in |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `read`, `readFromMemory`, the helpers, the export, and every type | anywhere |
| `@sugarcube-sh/dtcg/node` | `read` from disk, `liveDocument` to keep one current with its files, and `findResolver` | Node, Deno, Bun |
| `@sugarcube-sh/dtcg/values` | one parser per token type, and the spec's lists of units, keywords, color spaces and composite parts | anywhere |

## Some quick examples

Read a design system in any runtime:

```ts
import { read } from "@sugarcube-sh/dtcg";

const doc = await read("tokens.resolver.json", {
    readText: (path) => fetch(path).then((r) => r.text()),
});
```

Or from disk:

```ts
import { read } from "@sugarcube-sh/dtcg/node";

const doc = await read("tokens/tokens.resolver.json");
```

List every token, its value in every permutation, and which tokens use it:

```ts
import { byToken, referrers } from "@sugarcube-sh/dtcg";

for (const t of byToken(doc)) {
    console.log(
        t.path,
        t.permutations.default?.resolved,
        t.permutations.dark?.resolved,
        referrers(doc, t.path).map((r) => r.path),
    );
}
```

Report every error, with its location:

```ts
import { errors } from "@sugarcube-sh/dtcg";

for (const d of errors(doc)) {
    console.log(`${d.at?.file}:${d.at?.start.line}:${d.at?.start.column} ${d.message}`);
}
```

See what changed between two reads:

```ts
import { diff } from "@sugarcube-sh/dtcg";

for (const change of diff(before, after)) {
    console.log(change.kind, change.path);
}
```

Export a theme as one self-contained DTCG file:

```ts
import { toDTCG } from "@sugarcube-sh/dtcg";

const { tokens, skipped } = toDTCG(doc, { theme: "dark" });
```

Check a single value with no document at all:

```ts
import { parseColor } from "@sugarcube-sh/dtcg/values";

const result = parseColor(input.value, []);
input.setCustomValidity(result.ok ? "" : (result.errors[0]?.message ?? "Not a color"));
```

## Beyond the spec

`read` takes options for what the spec leaves to tools:

- `extensionValidators`: checks for your own `$extensions` keys, made with `defineExtensionValidator`
- `generators`: tokens made from a setting on a group, such as a scale, made with `defineGenerator`
- `inputs`: which permutations to build

## License

MIT. See [LICENSE.md](./LICENSE.md).
