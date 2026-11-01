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
    "red":   { "$value": { "colorSpace": "srgb", "components": [0.8, 0.2, 0.2] } },
    "blue":  { "$value": { "colorSpace": "srgb", "components": [0.2, 0.4, 0.8] } },
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
text?.resolved                          // { colorSpace: "srgb", components: [0.8, 0.2, 0.2], alpha: 1 }
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
(`tokens.referencesTo(path)`), and whether a name is there at all (`tokens.has(path)`). So whether
anything uses a token, before you delete it, is a question for the files, and it counts a
reference in a context the read didn't build:

```ts
const used = tokens.referencesTo("color.red").length > 0;
```

## Ask every permutation at once

`tokens.permutations` is a list, so a question with one answer across all of them, such as whether
a token is missing from any permutation, is a plain `some`, `every` or `find`:

```ts
const missingSomewhere = tokens.permutations.some((p) => p.token("color.text") === undefined);
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
    row(path, permutations.label, cssValue(answer));
  }
}
// color.red    everywhere    rgb(204 51 51)
// color.blue   everywhere    rgb(51 102 204)
// color.brand  everywhere    rgb(204 51 51)
// color.text   mode: light   rgb(204 51 51)
// color.text   mode: dark    rgb(51 102 204)
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

## Read in a browser, or anywhere without files

In Node, `read` opens files from disk. Anywhere else, such as a browser, a worker or an edge
function, give it `readText`: a function that gets a file's text. Return `undefined` for a file
that isn't there, and throw when you couldn't get it at all.

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

## Write CSS

```ts
import { cssBlocks, cssCustomProperty, cssText, cssValue } from "@sugarcube-sh/dtcg/css";

const text = tokens.permutation({ mode: "dark" }).token("color.text");

cssCustomProperty("color.text")         // "--color-text"
cssValue(text)                          // "rgb(51 102 204)"
cssValue(text, {
  replacement: (ref) =>
    ref.token ? { customProperty: cssCustomProperty(ref.token.path) } : undefined,
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
    --color-red: rgb(204 51 51);
    --color-blue: rgb(51 102 204);
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

## Use your own extensions

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
| `hexStringColors` | Reads a color written as a hex string, such as `"#e11d48"`, as sRGB, and writes it to CSS as that string. Not DTCG 2025.10. Off by default. |
| `ignoreUnknownProperties` | Reads a value with a property its type doesn't define by setting that property aside, with a warning. Not DTCG 2025.10. Off by default. |

### Questions you ask a permutation

Ask them of `tokens` when there's one permutation (a token file, or a resolver with no
modifiers), and of `tokens.permutation(input)` otherwise: with several, `tokens` throws a
`SeveralPermutationsError` saying how to pick one. `refersTo`, `referencesTo` and `usedBy` take
`{ chained: true }` to follow references through other tokens. `token`, `group`, `tokenOrGroup`,
`tokens`, `groups`, `children`, `topLevel`, `usedBy` and `refersTo` are the ones `tokens` answers
directly. `referencesTo` and `diagnosticsFor` are asked of both: asked of a permutation, the
answer is about that permutation; asked of `tokens`, about the whole read, each part with the
permutations it holds in (below).

| | What it gives |
| --- | --- |
| `token(path)`, `group(path)`, `tokenOrGroup(path)` | One token, one group, or whichever is at the path |
| `tokens`, `groups`, `children` | Every token, every group, and the tokens and groups at the top level |
| `topLevel` | What the top of the files writes: its `$type`, `$description`, `$deprecated` and `$extensions` |
| `refersTo(path)` | The references a path's value writes: what it points to |
| `referencesTo(path)` | Every reference written to a path, each with the token that writes it |
| `usedBy(path)` | Each token or group that refers to a path, once: what depends on it |
| `diagnosticsFor(path)` | The problems about one token or group |
| `input`, `label`, `isDefault` | The input that built it, a label for people naming every modifier's context, and whether every modifier is at its default |
| `contexts`, `sources` | The context it picks for each modifier, and every source it reads, in resolution order |

The three about references, side by side:

```ts
dark.refersTo("color.text")        // the references color.text's value writes: to color.blue
dark.referencesTo("color.red")     // each reference written to color.red, with the token that writes it
dark.usedBy("color.red")           // each token or group that refers to color.red, once: [color.brand]
tokens.referencesTo("color.red")   // each place {color.red} is typed in the files, with the tokens that have it
```

### What a read gives you

| | What it is |
| --- | --- |
| `files`, `entry`, `text(file)` | Every file the read used, the one it started from, and a file's text exactly as read |
| `resolver` | What the resolver document says about itself: its sets, and its modifiers with their contexts and defaults |
| `permutations`, `permutation(input)` | Every permutation built, and one by its input. `permutation()` gives the default |
| `tokenPaths()`, `groupPaths()`, `has(path)` | Every token and group path, and whether a path is there, in any permutation |
| `writtenAt(path)` | Every place a token or group is written in the files, each with the permutations that read it and the ones its value wins in |
| `referencesTo(path)` | Every reference to a path typed in the files, each place once, with the tokens that have it and the permutations it holds in: what renaming it rewrites, and whether anything uses it at all |
| `sources` | Every source the resolver lists, once |
| `diagnostics`, `diagnosticsFor(path)` | Every problem, or those about one token or group, each with the permutations it holds in |
| `diagnosticsAt(place)`, `spanOf(place)` | The problems at a place in a file, and where something is written, for editors |
| `jsonPathOf(place)`, `jsonAt(file, jsonPath)` | Where a place or reference sits in its file's JSON, such as `["color", "text"]`, and what the file writes there, for a tool writing files |
| `reread(changed)`, `rereadAll(files)`, `diff(before)` | New tokens after files changed, and what changed |
| `toMemory()` | The entry and every file's text, to read the same tokens somewhere else |
| `parseOptions` | How the read read values, such as whether it took hex strings: give it to `parseValue` to read another value, such as one inside `$extensions`, the same way |

### A token

| | What it is |
| --- | --- |
| `path`, `type` | Its path and its type |
| `value`, `resolved` | Its value as written, with references kept, and its resolved value. `isReference(token.value)` (from `@sugarcube-sh/dtcg`) tells a reference from a value |
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

### Working with token paths

A token's path is its group names and its own name, joined with dots: `color.brand.500`. The spec
has rules that are easy to get wrong by hand: a group can be named `""`, a `$root` token stands for
its group, and `color.brandy` isn't inside `color.brand`. `tokenPath` follows them.

```ts
import { tokenPath } from "@sugarcube-sh/dtcg";

tokenPath.parent("color.brand.500")                    // "color.brand"; undefined at the top level
tokenPath.join("color.brand", "500")                   // "color.brand.500"
tokenPath.relative("color", "color.brand.ink")         // "brand.ink"; undefined when it isn't inside
tokenPath.contains("color.brand", "color.brand.500")   // true, and for "color.brand" itself
tokenPath.withoutRoot("color.accent.$root")            // "color.accent", the name a $root token stands for
tokenPath.invalidCharacter("brand.500")                // ".", which no name may hold; undefined for a valid name
tokenPath.afterMoves("color.brand.500", [{ from: "color.brand", to: "color.house" }])
                                                       // "color.house.500", where it is after a rename
```

When files changed because something was renamed, tell `diff` what moved, and it reports the
token as renamed rather than removed and added: `after.diff(before, { moved })`. Each reference's
`moved(moves)` gives how it's written after the rename.

### Writing files

For a tool that writes token files, beside `tokens.jsonPathOf(place)` and `tokens.jsonAt(file, jsonPath)`:

| Import from | | What it does |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `filePath(entry, file)` | Where a file the read names really is: `filePath("tokens/tokens.resolver.json", "dark.json")` is `"tokens/dark.json"` |
| `@sugarcube-sh/dtcg/node` | `fileOnDisk(entry, file)` | The same, as an absolute path on disk |
| `@sugarcube-sh/dtcg/values` | `parseReference(value)` | Which reference a value written in a file is, in either syntax, or `undefined` |
| | `toJsonPointer(reference)` | A reference written as a JSON Pointer: `{color.ink}` is `{ "$ref": "#/color/ink/$value" }` |

### Writing a generator or a validator

| | What it does |
| --- | --- |
| `defineGenerator(…)`, `defineExtensionValidator(…)` | Make one, for `read`'s `generators` and `extensionValidators` |
| `createExtensionReader()` (`/values`) | Collects the problems your extension's value has, each with where it is, and its result |
| `isJsonObject(value)` (`/values`) | Whether a JSON value is an object, for reading an extension whose shape `dtcg` can't know |

### Comparing

| | What it does |
| --- | --- |
| `isEqualJson(a, b)` | Whether two JSON values are the same, whatever order their keys are in |
| `isEquivalentValue(type, a, b)` | Whether two values of a type mean the same, written differently: components that agree once rounded, a color with or without its `hex` |

### Labels and CSS names

| Import from | | What it does |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `inputLabel(input)` | An input written as a label, as permutations are labelled: `mode: dark, size: small` |
| `@sugarcube-sh/dtcg/css` | `cssIdentifier(path)` | The identifier CSS builds names from: `color-brand-500`, before `--` or any prefix |
| | `cssCustomProperty(path)` | The custom property for a path, ready for a stylesheet: `--color-brand-500` |
| | `cssWriter(options)` | A writer with your own opinions: naming, such as a prefix, fallbacks, and which tokens to leave out. Pass it to `cssBlocks` |

### The spec's lists

From `@sugarcube-sh/dtcg/values`:

| | What it is |
| --- | --- |
| `tokenTypes`, `dimensionUnits`, `durationUnits`, `fontWeightKeywords`, `strokeStyleKeywords`, `lineCaps` | Each list as the spec gives it |
| `colorSpaces` | Each color space, with its components' ranges |
| `compositeParts` | The parts of each composite type, and each part's type |

### Finding and watching files

From `@sugarcube-sh/dtcg/node`:

| | What it does |
| --- | --- |
| `findResolver(paths)` | Finds the resolver document among files and folders |
| `onFileChanged(watcher, listener)` | Calls `listener` for each file a watcher says was saved |

### What's where

| Import from | For | Runs in |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `read` with your own `readText`, `readFromMemory`, `everyPermutation`, `tokenPath`, the errors, and every type | anywhere |
| `@sugarcube-sh/dtcg/node` | `read` from disk, `liveTokens`, `findResolver` | Node |
| `@sugarcube-sh/dtcg/css` | CSS custom properties, values and stylesheets | anywhere |
| `@sugarcube-sh/dtcg/values` | checking one value, and the spec's lists | anywhere |

## License

MIT. See [LICENSE.md](./LICENSE.md).
