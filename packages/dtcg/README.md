# @sugarcube-sh/dtcg

Design tokens are the small decisions a design system is built from: a brand color, a spacing size,
a font. [DTCG](https://www.designtokens.org/) is a standard way of writing them in JSON files, so any
tool can read the same files.

Most design token tools are build tools: you give them a config, and they write files. This is the
layer underneath. It reads DTCG files exactly as the spec writes them and hands you everything it
found, so you can build whatever you need on top: a build tool, a docs site, a linter, an editor, a
sync with a design app. sugarcube is built on it, and any token tool could be.

It's built for three things. Exact: it follows DTCG 2025.10 as written, including resolvers, all
fourteen color spaces, and references written either way. Fast: fast enough to read your tokens
again on every keystroke, a few hundred tokens in about 5 milliseconds. Clear: when something's
wrong, it says where, why, and usually what you meant. It runs anywhere JavaScript does.

NB. Not released yet.

## Install

```bash
npm install @sugarcube-sh/dtcg
```

## Read a token file

```jsonc
// color.json
{
  "color": {
    "$type": "color",
    "red":   { "$value": { "colorSpace": "srgb", "components": [0.86, 0.15, 0.15] } },
    "blue":  { "$value": { "colorSpace": "srgb", "components": [0.15, 0.39, 0.92] } },
    "brand": { "$value": "{color.red}" },
    "text":  { "$value": "{color.brand}" },
    "link":  { "$value": "{color.bleu}" }
  }
}
```

```ts
import { read } from "@sugarcube-sh/dtcg/node";

const tokens = await read("color.json");

const text = tokens.token("color.text"); // undefined for a path that isn't there
text?.type                              // "color"
text?.value                             // { syntax: "curly-brace", path: "color.brand" }, as written
text?.resolved                          // { colorSpace: "srgb", components: [0.86, 0.15, 0.15], alpha: 1 }
text?.aliasChain.map((t) => t.path)     // ["color.text", "color.brand", "color.red"]

tokens.usedBy("color.red")              // [color.brand]
tokens.refersTo("color.text")           // the reference its value writes, to color.brand
tokens.group("color")?.tokens           // every token in the group, in the order the file writes them
```

`color.link` has a typo on purpose. A problem never stops a read: it goes in `tokens.diagnostics`,
and everything else is read as normal.

```ts
for (const problem of tokens.diagnostics) {
  console.log(problem.severity, `${problem.span?.file}:${problem.span?.start.line}`, problem.message);
}
// error color.json:8 `color.bleu` does not exist; did you mean `color.blue`?
```

Every problem has a `kind` you can switch on, the facts its message was written from in `detail`,
and a `docs` link that explains it.

## Add a resolver

A resolver document says which files to read, and how they change. Its modifiers each have
contexts: here, one modifier, `mode`, with the contexts `light` and `dark`. Dark adds one more
file.

```jsonc
// tokens.resolver.json
{
  "version": "2025.10",
  "resolutionOrder": [
    { "type": "set", "name": "base", "sources": [{ "$ref": "color.json" }] },
    {
      "type": "modifier", "name": "mode", "default": "light",
      "contexts": { "light": [], "dark": [{ "$ref": "dark.json" }] }
    }
  ]
}

// dark.json
{ "color": { "text": { "$type": "color", "$value": "{color.blue}" } } }
```

Now `color.text` has two answers, so `tokens` can't give one:

```ts
const tokens = await read("tokens.resolver.json");

tokens.token("color.text")
// SeveralPermutationsError: tokens.token() needs a permutation: this resolver has the modifier
// `mode`. Pick one with tokens.permutation({ mode: "dark" }), or ask them all with
// everyPermutation(tokens, …)
```

Pick a context for each modifier. The spec calls that an input, and the tokens it gives a
permutation. You ask a permutation exactly what you'd ask a single file:

```ts
const dark = tokens.permutation({ mode: "dark" });

dark.token("color.text")?.resolved      // blue
dark.usedBy("color.red")                // [color.brand]
dark.label                              // "mode: dark"

const light = tokens.permutation();     // no input: every modifier at its default
light.token("color.text")?.resolved     // red
light.label                             // "mode: light"
```

What's about the files themselves, not one permutation, `tokens` still answers with a resolver:
where a token is written (`tokens.writtenAt(path)`), every reference typed to it
(`tokens.referencedBy(path)`), and whether a name is there at all (`tokens.has(path)`).

## Ask every permutation at once

`tokens.permutations` is a list, so a question with one answer across all of them, such as whether
anything still uses a token before you delete it, is a plain `some`, `every` or `find`:

```ts
const usedAnywhere = tokens.permutations.some((p) => p.usedBy("color.red").length > 0);
```

To see permutations side by side, write the question you'd ask one permutation, and
`everyPermutation` asks it of each. Permutations that give the same answer come back together:

```ts
import { everyPermutation } from "@sugarcube-sh/dtcg";

everyPermutation(tokens, (p) => p.token("color.text")?.resolved)
// [{ answer: red,  permutations: mode: light },
//  { answer: blue, permutations: mode: dark }]
```

That's a docs page, each token's value in each permutation:

```ts
import { cssValue } from "@sugarcube-sh/dtcg/css";

for (const path of tokens.tokenPaths()) {
  for (const { answer, permutations } of everyPermutation(tokens, (p) => p.token(path))) {
    row(path, permutations.label, answer && cssValue(answer));
  }
}
// color.red    everywhere    rgb(219 38 38)
// color.blue   everywhere    rgb(38 99 235)
// color.brand  everywhere    rgb(219 38 38)
// color.text   mode: light   rgb(219 38 38)
// color.text   mode: dark    rgb(38 99 235)
// color.link   everywhere    undefined, since its reference names no token
```

A permutation's label names every modifier's context, and a group's names only what it narrows:
with two modifiers, `mode: dark, size: small` is one permutation, and `size: large` is every large
one. A token file has no modifiers, so its one permutation's label is `""`, and a tool can leave
labels out when `tokens.permutations.length === 1`.

## When files change

`reread` takes the files that changed, with `null` for one that was deleted, and gives you new
tokens. Files you don't pass are reused as they were. `diff` says what changed between two reads.

```ts
const fixed = tokens.reread({ "color.json": newText });

fixed.diagnostics.length                // 0
fixed.diff(tokens)                      // [{ kind: "changed", path: "color.link", … }]
```

In Node, `liveTokens` does this for you, for anything that runs for a while, such as a dev server,
a watch command or an editor:

```ts
import { liveTokens } from "@sugarcube-sh/dtcg/node";

const live = liveTokens({ entry: "tokens.resolver.json" }, { onError: console.error });
live.watch(watcher);
live.onRead((tokens, { file }) => console.log(`${file} saved`, tokens.diagnostics.length));
```

`watcher` is any file watcher with chokidar's `add` and `on`, such as chokidar itself, or the one
your dev server already runs.

## Read outside Node

Give `read` a way to fetch each file:

```ts
import { read } from "@sugarcube-sh/dtcg";

const tokens = await read("tokens.resolver.json", {
  readText: async (path) => {
    const response = await fetch(path);
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`${response.status}`);
    return response.text();
  },
});
```

Or, when you already have the files' text, use `readFromMemory`:

```ts
import { readFromMemory } from "@sugarcube-sh/dtcg";

const tokens = readFromMemory({ files: { "tokens.resolver.json": "…", "color.json": "…", "dark.json": "…" } });
```

## CSS

```ts
import { cssBlocks, cssText, cssValue, cssVariable } from "@sugarcube-sh/dtcg/css";

const text = tokens.permutation({ mode: "dark" }).token("color.text");

cssVariable("color.text")               // "--color-text"
text && cssValue(text)                  // "rgb(38 99 235)"
text && cssValue(text, {
  replacement: (ref) => (ref.token ? { variable: cssVariable(ref.token.path) } : undefined),
})                                      // "var(--color-blue)"
```

A whole stylesheet, one block per input:

```ts
cssText(
  cssBlocks(tokens, [
    { input: {}, selector: ":root" },
    { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
  ]),
);
```

```css
:root {
    --color-red: rgb(219 38 38);
    --color-blue: rgb(38 99 235);
    --color-brand: var(--color-red);
    --color-text: var(--color-brand);
}

[data-mode="dark"] {
    --color-text: var(--color-blue);
}
```

The block for `{ mode: "dark" }` writes only what the `dark` context changes. `color.link` is left
out, because its value can't be resolved.

## Check one value

To check a single value, with no files at all, such as a value someone types into a form:

```ts
import { parseValue } from "@sugarcube-sh/dtcg/values";

parseValue("color", { colorSpace: "srgb", components: [1, 0, 1] }, [])
// { ok: true, value: { colorSpace: "srgb", components: [1, 0, 1], alpha: 1 }, ignored: [] }

parseValue("color", "#e11d48", [])
// { ok: false, errors: [{ message: "`#e11d48` is a hex string, and a color must be an object", … }] }
```

## Your own extensions

The spec leaves `$extensions` to tools. `read` takes two options for them.

`extensionValidators` check your own extension, and report problems the same way as everything
else:

```ts
import { defineExtensionValidator } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";

const fluid = defineExtensionValidator({
  key: "com.example",
  appliesTo: ["dimension"],
  messages: {
    "not-a-boolean": ({ fluid }: { fluid: unknown }) =>
      `\`fluid\` must be true or false, not ${JSON.stringify(fluid)}`,
  },
  validate: (token, extension) => {
    const { fluid } = extension as { fluid?: unknown };
    return typeof fluid === "boolean"
      ? []
      : [{ jsonPath: ["fluid"], reason: "not-a-boolean", data: { fluid } }];
  },
});

const tokens = await read("tokens.resolver.json", { extensionValidators: [fluid] });
```

`generators` make tokens from an extension on a group, such as a scale, and are made with
`defineGenerator`. A generated token is read like any other, and says it was generated
(`token.generated`).

## Reference

### `read` options

| Option | What it does |
| --- | --- |
| `inputs` | The permutations to build, as inputs. Leave it out to build the ones `permutations` asks for. |
| `permutations` | `"all"`, every combination of contexts (the default), or `"each-context"`, each context with every other modifier at its default. |
| `permutationLimit` | The most combinations `"all"` builds before building `"each-context"` instead, with a warning. Default 32. |
| `extensionValidators` | Checks for your own `$extensions`, made with `defineExtensionValidator`. |
| `generators` | Tokens made from an extension on a group, made with `defineGenerator`. |
| `onStage` | Called as each stage of a read finishes, with how long it took. |
| `hexStringColors` | Reads a color written as a hex string, such as `"#e11d48"`, as sRGB. Not DTCG 2025.10. Off by default. |
| `ignoreUnknownProperties` | Reads a value with a property its type doesn't define by setting that property aside, with a warning. Not DTCG 2025.10. Off by default. |

### Questions you ask a permutation

Ask them of `tokens` when there's one permutation (a token file, or a resolver with no
modifiers), and of `tokens.permutation(input)` otherwise: with several, `tokens` throws a
`SeveralPermutationsError` saying how to pick one. `usedBy`, `refersTo` and `referencedBy` take
`{ chained: true }` to follow references through other tokens. `token`, `group`, `tokens`,
`groups`, `children`, `root`, `usedBy` and `refersTo` are the ones `tokens` answers directly;
`referencedBy` and `diagnosticsFor` on `tokens` cover every permutation (below).

| | What it gives |
| --- | --- |
| `token(path)`, `group(path)` | One token or group |
| `tokens`, `groups`, `children`, `root` | Every token and group, and what's at the top level |
| `usedBy(path)` | The tokens and groups that reference a path |
| `refersTo(path)` | The references a path's value writes, each with what it reaches |
| `referencedBy(path)` | Every reference to a path, with the token or group that writes it |
| `diagnosticsFor(path)` | The problems about one token or group |
| `input`, `label`, `isDefault` | The input that built it, a label for people naming every modifier's context, and whether every modifier is at its default |
| `contexts`, `sources` | The context it picks for each modifier, and every source it reads, in resolution order |

### What a read gives you

| | What it is |
| --- | --- |
| `files`, `entry`, `text(file)` | Every file the read used, the one it started from, and a file's text exactly as read |
| `resolver`, `modifier(name)` | What the resolver document says about itself, and one modifier with its contexts and default |
| `permutations`, `permutation(input)` | Every permutation built, and one by its input. `permutation()` gives the default |
| `tokenPaths()`, `groupPaths()`, `has(path)` | Every token and group path, and whether a path is there, in any permutation |
| `writtenAt(path)` | Every place a token or group is written in the files, each with the permutations that read it and the ones its value wins in |
| `referencedBy(path)` | Every reference to a path typed in the files, each with the permutations it holds in: what renaming it rewrites |
| `sources` | Every source the resolver lists, once |
| `diagnostics`, `diagnosticsFor(path)` | Every problem, or those about one token or group, each with the permutations it holds in |
| `diagnosticsAt(place)`, `spanOf(place)` | The problems at a place in a file, and where something is written, for editors |
| `jsonPathOf(place)`, `jsonAt(file, jsonPath)` | Where a place or reference sits in its file's JSON, such as `["color", "text"]`, and what the file writes there, for a tool writing files |
| `reread(changed)`, `rereadAll(files)`, `diff(before)` | New tokens after files changed, and what changed |
| `toMemory()` | The entry and every file's text, to read the same tokens somewhere else |

### A token

| | What it is |
| --- | --- |
| `path`, `type` | Its path and its type |
| `value`, `resolved` | Its value as written, with references kept, and its resolved value |
| `invalid` | Set when its value couldn't be read |
| `description`, `deprecated`, `extensions` | Its `$description`, `$deprecated` and `$extensions` |
| `references`, `referenceAt(property)`, `aliasChain` | The references its value writes, and every token it passes through to resolve |
| `valueFrom`, `writtenAt`, `authored` | Where its value comes from, every place it's written, and what that file wrote. `tokens.spanOf(place)` gives a place's position in the file, `tokens.jsonPathOf(place)` its path in the JSON |
| `inherited`, `generated` | Set when it's there because of `$extends`, or a generator made it |
| `parts` | Each part of a composite value, each shadow layer or gradient stop, with what it resolved to |

### `everyPermutation(tokens, question)`

Asks `question` of every permutation, and gives back each answer once, with the permutations it
came from: `{ answer, permutations }`. Two answers are the same when they're the same value, or
lists of the same values in the same order. A token the same in two permutations is one object in
both, so asking for it puts them together. One answer means it's the same everywhere.

### A list of permutations

`tokens.permutations`, and the `permutations` of an answer, a problem or a change, is a read-only
list of permutations, with:

| | What it is |
| --- | --- |
| `label` | Which permutations it holds, for people, such as `mode: dark` or `everywhere` |
| `inputs`, `scope` | Their inputs, and which permutations it holds by their contexts, for a tool that words them its own way |
| `others` | Every permutation the read built that it doesn't hold, itself a list: none when it holds them all |
| `where(test)`, `matching(input)` | The ones that pass a test, and the one an input picks |

### Errors

| | Thrown by |
| --- | --- |
| `PermutationError` | `tokens.permutation(input)` when no permutation fits the input; `detail` says why |
| `SeveralPermutationsError` | A question of one permutation asked of `tokens` with several; `detail` has an example input |

### Helpers

| Import from | | What it does |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `completeInput(tokens, input)` | An input with every modifier given and its defaults filled in |
| | `permutationLabel(input)` | An input written out for people, such as `mode: dark` |
| | `isReference(value)` | Whether a value is a reference |
| | `withoutRoot(path)` | The path a `$root` token stands for: its group's path |
| `@sugarcube-sh/dtcg/node` | `findResolver(paths)` | Finds the resolver document among files and folders |
| | `onFileChanged(watcher, listener)` | Calls `listener` for each file a watcher says was saved |
| `@sugarcube-sh/dtcg/values` | `readReference(value)` | Which reference a value written in a file is, in either syntax |
| | `writtenColor(color)` | A color ready to write into a file, rounded to four decimal places |
| | `compositeParts` | The parts of each composite type, and each part's type |
| | `tokenTypes`, `dimensionUnits`, `durationUnits`, `fontWeightKeywords`, `strokeStyleKeywords`, `lineCaps` | The spec's lists |
| | `colorSpaces` | Each color space, with its components' ranges |
| `@sugarcube-sh/dtcg/css` | `cssName(path)` | The name CSS knows a token path by, before escaping |
| | `cssWriter(options)` | A writer with your own opinions: naming, such as a prefix, fallbacks, and which tokens to leave out. Pass it to `cssBlocks` |

### What's where

| Import from | For | Runs in |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `read` with your own `readText`, `readFromMemory`, `everyPermutation`, the errors, the helpers, and every type | anywhere |
| `@sugarcube-sh/dtcg/node` | `read` from disk, `liveTokens`, `findResolver` | Node |
| `@sugarcube-sh/dtcg/css` | CSS variables, values and stylesheets | anywhere |
| `@sugarcube-sh/dtcg/values` | checking one value, and the spec's lists | anywhere |

## License

MIT. See [LICENSE.md](./LICENSE.md).
