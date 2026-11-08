# @sugarcube-sh/dtcg

**Read DTCG design token files, and build anything on top of them.**

Design tokens are the small decisions a design system is made of: a brand color, a spacing size, a
font. [DTCG](https://www.designtokens.org/) is the standard way to write them in JSON, so every
tool can read the same files.

dtcg reads those files and gives you everything in them: every token and its value, every theme,
and every mistake, with where it is. You build the rest: a docs site, a linter, a CSS build, an
editor. sugarcube is built on it.

It's built to be:

- **Exact.** It follows the DTCG standard (version 2025.10) as written, all of it.
- **Fast.** A few hundred tokens read in about 5 milliseconds, so you can read them again on every
  keystroke.
- **Clear.** When something's wrong, it says where, why, and usually what you meant.

It runs anywhere JavaScript runs.

NB. Not released yet.

## Install

```bash
npm install @sugarcube-sh/dtcg
```

## What you can build

**A docs page** listing every token's value in every theme:

```ts
import { askEveryPermutation } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { toCSSValue } from "@sugarcube-sh/dtcg/css";

const tokens = await read("tokens.resolver.json");

for (const path of tokens.getTokenPaths()) {
  for (const { answer, permutations } of askEveryPermutation(tokens, (p) => p.getToken(path))) {
    row(path, permutations.label, toCSSValue(answer));
  }
}
// color.red    everywhere    rgb(204 51 51)
// color.text   mode: light   rgb(204 51 51)
// color.text   mode: dark    rgb(51 102 204)
```

**A check in CI** that fails when a token file has a mistake:

```ts
const errors = tokens.diagnostics.filter((problem) => problem.severity === "error");
for (const { span, message } of errors) console.error(`${span?.file}:${span?.start.line}  ${message}`);
process.exitCode = errors.length > 0 ? 1 : 0;
// color.json:8  `color.bleu` does not exist; did you mean `color.blue`?
```

**CSS custom properties**, one block per theme:

```ts
import { getCSSBlocks, toCSS } from "@sugarcube-sh/dtcg/css";

toCSS(getCSSBlocks(tokens, [
  { input: {}, selector: ":root" },
  { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
]));
```

**A safe delete,** checking nothing uses a token first:

```ts
const used = tokens.getReferencesTo("color.red").length > 0;
```

Each one is explained, step by step, below.

## The ideas, in two minutes

```jsonc
// color.json
{
  "color": {
    "$type": "color",
    "red":  { "$value": { "colorSpace": "srgb", "components": [0.8, 0.2, 0.2] } },
    "blue": { "$value": { "colorSpace": "srgb", "components": [0.2, 0.4, 0.8] } },
    "text": { "$value": "{color.red}" }
  }
}
```

- A **token** is one named value, such as `red`. Its **path** is its groups and its name, joined
  with dots: `color.red`.
- A **group** holds tokens and other groups: here, `color`.
- A **reference** is a value that points at another token: `text` is `{color.red}`. Following
  references gives a token's **resolved** value.

That's a token file. When your tokens change with a theme, a **resolver** file says which token
files to read, and how:

- A **modifier** is something that varies, such as `mode`. Its **contexts** are the choices, such
  as `light` and `dark`.
- An **input** picks a context for each modifier, such as `{ mode: "dark" }`. The tokens it gives
  you are a **permutation**.

```ts
const dark = tokens.getPermutation({ mode: "dark" });
dark.getToken("color.text")?.resolved   // blue
```

A token file on its own has no modifiers, so there's just one permutation, and you ask `tokens`
directly: `tokens.getToken("color.text")`.

## Read a token file

### Get one token

Here's a token file. It's the one from above, with two more tokens:

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

Read it with `read`, then ask for a token by its path with `getToken`:

```ts
import { read } from "@sugarcube-sh/dtcg/node";

const tokens = await read("color.json");

const text = tokens.getToken("color.text");
if (!text) throw new Error("color.text isn't in color.json");

text.resolved   // { colorSpace: "srgb", components: [0.8, 0.2, 0.2], alpha: 1 }
```

Things to notice:

- `read` is async: it opens the file, so you `await` it.
- `resolved` is the token's real value. `color.text` points at `color.brand`, which points at
  `color.red`, so its value is red.
- `alpha: 1` was added. The file didn't write an alpha, and 1 is what the standard says it means.
- `getToken` gives `undefined` when there's no token at that path, so check once that you got
  one. After the check, TypeScript knows `text` is a token, and every line can use it plainly.

### Look closer at a token

A token tells you more than its value:

```ts
text.type                            // "color"
text.value                           // { syntax: "curly-brace", path: "color.brand" }
text.aliasChain.map((t) => t.path)   // ["color.text", "color.brand", "color.red"]
```

- `type` is its `$type`. This file writes `"$type": "color"` on the group, so every token in it is
  a color.
- `value` is what the file wrote, before following references. Here, that's a reference to
  `color.brand`.
- `aliasChain` is every token it passes through to get its value, starting with itself.

To check whether a value is a reference, use `isReference`:

```ts
import { isReference } from "@sugarcube-sh/dtcg";

isReference(text.value)   // true
```

### Find related tokens

Ask what a token uses, and what uses it:

```ts
tokens.getDependencies("color.text")   // [color.brand]: what color.text uses
tokens.getDependents("color.red")      // [color.brand]: what uses color.red
```

They only look one step away. To follow the whole chain, add `{ chained: true }`:

```ts
tokens.getDependencies("color.text", { chained: true })   // [color.brand, color.red]
tokens.getDependents("color.red", { chained: true })      // [color.brand, color.text]
```

### Look at a group

```ts
tokens.getGroup("color")?.tokens   // [color.red, color.blue, color.brand, color.text, color.link]
tokens.getTokenPaths()             // ["color.red", "color.blue", "color.brand", "color.text", "color.link"]
```

Tokens always come back in the order the file writes them.

## Find mistakes

### List every mistake

`color.link` points at `color.bleu`, which doesn't exist. dtcg doesn't stop when it finds a
mistake. It reads everything else as normal, and puts the mistake in `tokens.diagnostics`:

```ts
for (const problem of tokens.diagnostics) {
  console.log(problem.severity, `${problem.span?.file}:${problem.span?.start.line}`, problem.message);
}
// error color.json:8 `color.bleu` does not exist; did you mean `color.blue`?
```

Things to notice:

- "Diagnostics" is the usual name for problems found in code. Editors use it too.
- `severity` is how serious it is. `"error"` means the file breaks a rule of DTCG. `"warning"`
  means it doesn't, but probably isn't what you meant, or something was set aside. `"info"` and
  `"hint"` are things worth knowing.
- `span` says where the mistake is: the file, and the line and column it starts and ends at.
- The other tokens are all fine. Only `color.link` has no value: `tokens.getToken("color.link")?.resolved`
  is `undefined`.

### Look closer at a problem

Every problem has the same fields. Here's all of this one:

```ts
const [problem] = tokens.diagnostics;
if (!problem) throw new Error("expected the color.bleu mistake");

problem.kind      // "missing-reference"
problem.path      // "color.link"
problem.detail    // { ref: "color.bleu", from: ["color.link"], similar: "color.blue" }
problem.docsUrl   // "https://sugarcube.sh/errors/missing-reference"
```

- `kind` is a name for the kind of mistake. Check it in code, rather than the message, which might
  change.
- `path` is the token or group it's about.
- `detail` holds the facts the message was written from, so you can write your own message.
- `docsUrl` links to a page that explains the mistake and how to fix it.

### Problems with one token

To get only the problems with one token or group, use `getDiagnostics`:

```ts
tokens.getDiagnostics("color.link")   // [the missing-reference problem]
tokens.getDiagnostics("color.red")    // []
```

## Themes

### Add a resolver

A resolver is a JSON file that says which token files to read. It's how the standard does themes,
such as light and dark.

This resolver reads `color.json` always. It has one modifier, `mode`, with two contexts, `light`
and `dark`. When the mode is dark, it reads `dark.json` too:

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
{ "color": { "text": { "$value": "{color.blue}" } } }
```

`dark.json` changes one token: in dark, `color.text` is blue. It doesn't need to write
`"$type": "color"`: the `color` group in `color.json` already makes every token in it a color.

### Read one theme

Read the resolver the same way as a token file. Then pick a theme with `getPermutation`, and ask
it anything you'd ask a token file:

```ts
const tokens = await read("tokens.resolver.json");

const dark = tokens.getPermutation({ mode: "dark" });
dark.getToken("color.text")?.resolved   // blue
dark.label                              // "mode: dark"
```

With no input, you get the default, where every modifier is at its `default`:

```ts
const light = tokens.getPermutation();
light.getToken("color.text")?.resolved  // red
light.label                             // "mode: light"
```

`label` is a name for people. Use it in headings, menus and messages.

### Why `tokens.getToken` throws now

With a resolver, `color.text` has two values: red in light, blue in dark. So `tokens` can't answer
on its own. It throws, and says what to do instead:

```ts
tokens.getToken("color.text")
// SeveralPermutationsError: tokens.getToken() needs a permutation: this resolver has the modifier
// `mode`. Pick one with tokens.getPermutation({ mode: "dark" }), or ask them all with
// askEveryPermutation(tokens, …)
```

A token file has no modifiers, so it has only one permutation. That's why `tokens.getToken`
worked before.

### Questions about the files

Some questions are about the files, not one theme. `tokens` answers these even with a resolver:

```ts
tokens.has("color.text")                     // true: it's there in some theme
tokens.getDefinitions("color.text").length   // 2: it's written in color.json and in dark.json
tokens.getReferencesTo("color.blue")         // [the {color.blue} that dark.json writes]
tokens.files                                 // ["tokens.resolver.json", "color.json", "dark.json"]
```

### Pick a theme that isn't there

Ask for a context the resolver doesn't have, and `getPermutation` throws a `PermutationError`:

```ts
tokens.getPermutation({ mode: "dim" })
// PermutationError: `dim` is not a context of the modifier `mode`
```

## Every theme at once

### List the themes

`tokens.permutations` is every permutation the read built, as a list:

```ts
tokens.permutations.map((p) => p.label)   // ["mode: light", "mode: dark"]
```

Because it's a list, you can use `some`, `every` and `find`. For example, to check whether a token
is missing from any theme:

```ts
const missingSomewhere = tokens.permutations.some((p) => p.getToken("color.text") === undefined);
```

### Compare them side by side

Write the question you'd ask one theme, and `askEveryPermutation` asks it of each. Themes that give
the same answer come back together:

```ts
import { askEveryPermutation } from "@sugarcube-sh/dtcg";

askEveryPermutation(tokens, (p) => p.getToken("color.text")?.resolved)
// [{ answer: red,  permutations: mode: light },
//  { answer: blue, permutations: mode: dark }]

askEveryPermutation(tokens, (p) => p.getToken("color.red")?.resolved)
// [{ answer: red, permutations: everywhere }]
```

Things to notice:

- `color.red` is the same in both themes, so there's one answer, labelled `everywhere`.
- `permutations` is a list too, with its own `label`.

That's how the docs page at the top works. Here's all of its output for these files:

```text
color.red    everywhere    rgb(204 51 51)
color.blue   everywhere    rgb(51 102 204)
color.brand  everywhere    rgb(204 51 51)
color.text   mode: light   rgb(204 51 51)
color.text   mode: dark    rgb(51 102 204)
color.link   everywhere    undefined, since its reference names no token
```

### Labels with more than one modifier

With two modifiers, say `mode` and `size`, a permutation's label names both: `mode: dark, size: small`.
A label for several permutations names only what they have in common: `size: large` means every
large one, light and dark.

A token file has one permutation, and its label is `""`. When `tokens.permutations.length === 1`,
leave labels out.

### When there are lots of themes

By default, `read` builds every combination of contexts. Three modifiers with three contexts each
is 3 × 3 × 3 = 27 permutations.

To build fewer, use the `inputs` option. `"each-context"` builds each context once, with every other
modifier at its default:

```ts
const tokens = await read("tokens.resolver.json", { inputs: "each-context" });
// 7 permutations, not 27: the default, plus each other context on its own
```

Or list exactly the inputs you want:

```ts
const tokens = await read("tokens.resolver.json", { inputs: [{ mode: "dark" }] });
```

If every combination would be more than 32, `read` builds `"each-context"` instead, and warns you
in `tokens.diagnostics`. Change the limit with `permutationLimit`.

## Check whether anything uses a token

Before you delete a token, check nothing points at it:

```ts
tokens.getReferencesTo("color.red").length > 0    // true: color.brand points at it
tokens.getReferencesTo("color.link").length > 0   // false: safe to delete
```

`getReferencesTo` looks at every file, in every theme, even ones the read didn't build.

Each reference says where it's written:

```ts
const [reference] = tokens.getReferencesTo("color.red");
if (!reference) throw new Error("expected color.brand's reference");

reference.writtenInPaths   // ["color.brand"]
reference.asWritten        // { syntax: "curly-brace", path: "color.red" }
```

## Write CSS

Most of the time you want a stylesheet: a CSS file with one custom property for each token. That
takes two functions, `getCSSBlocks` and `toCSS`.

### Write a stylesheet

Say which permutation goes under which CSS selector. Here the default (light) goes under `:root`,
and dark goes under `[data-mode="dark"]`:

```ts
import { getCSSBlocks, toCSS } from "@sugarcube-sh/dtcg/css";

const blocks = getCSSBlocks(tokens, [
  { input: {}, selector: ":root" },
  { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
]);

const css = toCSS(blocks);
```

`css` is now this text, ready to save to a file:

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

Things to notice:

- Each token becomes a custom property: `color.text` becomes `--color-text`.
- A reference stays a reference. `color.text` is `{color.brand}` in the file, so in CSS it's
  `var(--color-brand)`.
- The dark block only has what's different in dark. Everything else comes from `:root`.
- `color.link` isn't there at all. Its reference points at a token that doesn't exist, so there's
  nothing to write. It shows up in `tokens.diagnostics` instead.

Why two functions? `getCSSBlocks` gives you the blocks as plain data, and `toCSS` turns them into
text. In between, you can change the blocks if you need to, such as putting one inside a
`@media` query.

### Change how it's written

To change how the stylesheet is written, make a **writer** with `createCSSWriter`, and give it to
`getCSSBlocks`. If you don't give it one, it uses a writer with no changes, which is what you saw
above.

To put a prefix on every name:

```ts
import { createCSSWriter, getCSSBlocks, toCSS } from "@sugarcube-sh/dtcg/css";

const writer = createCSSWriter({ naming: { prefix: "ds" } });

toCSS(getCSSBlocks(tokens, [{ input: {}, selector: ":root" }], { writer }));
```

```css
:root {
    --ds-color-red: rgb(204 51 51);
    --ds-color-blue: rgb(51 102 204);
    --ds-color-brand: var(--ds-color-red);
    --ds-color-text: var(--ds-color-brand);
}
```

To leave a token out, use `skip`. Anything that referred to it gets its value instead:

```ts
const writer = createCSSWriter({ skip: (token) => token.path === "color.brand" });
```

```css
:root {
    --color-red: rgb(204 51 51);
    --color-blue: rgb(51 102 204);
    --color-text: var(--color-red);
}
```

A writer can also write a value another way (`writeValue`), and add a fallback for older browsers
(`writeFallback`). Both are described on `createCSSWriter`.

### Write one value

Sometimes you want one token's value, not a stylesheet: to show it on a docs page, or in a color
swatch. Use `toCSSValue`. It follows every reference until it reaches a real value:

```ts
import { toCSSValue, toCustomPropertyName } from "@sugarcube-sh/dtcg/css";

const text = tokens.getPermutation({ mode: "dark" }).getToken("color.text");

toCSSValue(text)                       // "rgb(51 102 204)"
toCustomPropertyName("color.text")     // "--color-text"
```

To see a token the way the stylesheet writes it, with its references kept, ask a writer:

```ts
createCSSWriter().getValue(text)?.css  // "var(--color-blue)"
```

## Read without a file system

### In a browser

`read` from `@sugarcube-sh/dtcg/node` opens files from disk, so it only works in Node.

Everywhere else, such as a browser, use `read` from `@sugarcube-sh/dtcg`, and tell it how to get a
file's text with `readText`:

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

Things to notice:

- `readText` is called once for each file: the resolver, then each file it names.
- Return `undefined` when a file isn't there. dtcg reports it as a mistake, like any other.
- Throw when you couldn't get the file at all, such as when the network is down. Then `read`
  throws too.

### From text you already have

If you already have every file's text, use `readFromMemory`. It doesn't need to wait for anything,
so it isn't async:

```ts
import { readFromMemory } from "@sugarcube-sh/dtcg";

const tokens = readFromMemory({ files: { "tokens.resolver.json": "…", "color.json": "…", "dark.json": "…" } });
```

## When files change

### Read again

When a file changes, give `reread` its new text. You get new tokens back. Files you don't pass are
kept as they were, so it's quick:

```ts
const fixed = tokens.reread({ "color.json": newText });

fixed.diagnostics.length   // 0: the typo is fixed
```

To say a file was deleted, pass `null` instead of its text.

`reread` doesn't fetch files. So if your tokens came from `read` and a changed file now points at a
file that read never fetched, pass that file's text too, or `read` again.

### See what changed

Ask the new tokens what changed since the old ones, with `getChangesSince`:

```ts
fixed.getChangesSince(tokens)
// [{ kind: "changed", path: "color.link", properties: ["value"], … }]
```

### Keep reading as files are saved

For something that runs for a while, such as a dev server, a watch command or an editor, use
`createLiveTokens`. It reads again each time a file is saved:

```ts
import { createLiveTokens } from "@sugarcube-sh/dtcg/node";

const live = createLiveTokens({ entryFile: "tokens.resolver.json" }, { onError: console.error });

live.watch(watcher);
live.onRead((tokens, { file }) => console.log(`${file} saved`, tokens.diagnostics.length));
```

Things to notice:

- `watcher` is the thing that notices files being saved. Use chokidar, or the watcher your dev
  server already runs.
- `onRead` is called after each read, with the new tokens and the file that was saved.
- To get the latest tokens at any time, `await live.getTokens()`.

## Check one value

### Is this value right?

To check a single value, with no files at all, such as a value someone types into a form, use
`parseValue`. Give it the type, and the value:

```ts
import { parseValue } from "@sugarcube-sh/dtcg/values";

parseValue("dimension", { value: 4, unit: "px" })
// { ok: true, value: { value: 4, unit: "px" }, ignored: [] }
```

### When it's wrong

When the value is wrong, `ok` is `false`, and `errors` says why:

```ts
parseValue("dimension", { value: 4, unit: "pt" })
// { ok: false, errors: [{ message: "`pt` is not a unit a dimension can have: the units are `px` and `rem`", jsonPath: ["unit"], … }] }
```

`jsonPath` says which part of the value is wrong: here, its `unit`.

## Your own extensions

The standard lets tools add their own data to a token, in `$extensions`. dtcg can check yours, and
make tokens from it.

### Check an extension

Say your tool reads a `fluid` setting from `$extensions`, and it must be `true` or `false`.
`defineExtensionValidator` checks it, and reports a mistake the same way dtcg reports its own:

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

A token that writes `"$extensions": { "com.example": { "fluid": "yes" } }` now gets this in
`tokens.diagnostics`:

```text
error  `fluid` must be true or false, not "yes"
```

Things to notice:

- `key` is your extension's name in `$extensions`. The standard says to use a reversed domain
  name, like `com.example`.
- `appliesTo` says which token types to check. Other types are left alone.
- `validate` returns a list of mistakes, empty when there are none. Each names its message by
  `reason`, and passes the facts the message needs in `data`.

### Make tokens from an extension

A generator makes tokens from an extension on a group: a spacing scale, say, from a base size and
a ratio. Make one with `defineGenerator`, and pass it to `read`'s `generators` option. The tokens
it makes are read like any other, and have `token.generated` set, so you can tell them apart.

## Reference

### `read` options

| Option | What it does |
| --- | --- |
| `inputs` | Which permutations to build: a list of inputs, `"all"`, every combination of contexts (the default), or `"each-context"`, each context with every other modifier at its default. |
| `permutationLimit` | The most combinations `"all"` builds before building `"each-context"` instead, with a warning. Default 32. |
| `extensionValidators` | Checks for your own `$extensions`, made with `defineExtensionValidator`. |
| `generators` | Tokens made from an extension on a group, made with `defineGenerator`. |
| `onStage` | Called as each stage of a read finishes, with how long it took. |
| `hexStringColors` | Reads a color written as a hex string, such as `"#e11d48"`, as sRGB, and writes it to CSS as that string. Not DTCG 2025.10. Off by default. |
| `ignoreUnknownProperties` | Reads a value with a property its type doesn't define by setting that property aside, with a warning. Not DTCG 2025.10. Off by default. |

### Questions you ask a permutation

Ask these of a permutation: `tokens.getPermutation(input)`. A token file has only one
permutation, so you can ask `tokens` directly. With a resolver that has modifiers, asking `tokens`
throws a `SeveralPermutationsError`.

Two of them, `getReferencesTo` and `getDiagnostics`, work on `tokens` too. Asked of a permutation,
they answer for that permutation. Asked of `tokens`, they answer for every file, and each answer
says which permutations it's true in.

`getDependencies`, `getDependents` and `getReferencesTo` look one step away. Add
`{ chained: true }` to follow the whole chain.

| | What it gives |
| --- | --- |
| `getToken(path)`, `getGroup(path)`, `getTokenOrGroup(path)` | One token, one group, or whichever is at the path |
| `tokens`, `groups`, `children` | Every token, every group (the top level first), and the tokens and groups at the top level |
| `topLevel` | The top of the files, which is a group: the group at `""` |
| `getDependencies(path)` | Each token or group a path's value refers to, once: what it depends on |
| `getDependents(path)` | Each token or group that refers to a path, once: what depends on it |
| `getReferencesTo(path)` | Every reference written to a path, each with the token that writes it |
| `getDiagnostics(path)` | The problems about one token or group |
| `input`, `label`, `isDefault` | The input that built it, a label for people naming every modifier's context, and whether every modifier is at its default |
| `contexts`, `sources` | The context it picks for each modifier, and every source it reads, in resolution order |

Ways to ask about references, which are easy to mix up. Dependencies and dependents are tokens,
each once. References are each `{path}` or `$ref` written in a file, with where it's written:

```ts
dark.getDependencies("color.text")          // [color.blue]: what color.text refers to
dark.getDependents("color.red")             // [color.brand]: what refers to color.red
dark.getToken("color.text")?.references     // the references color.text's value writes
dark.getReferencesTo("color.red")           // each reference written to color.red, with the token that writes it
tokens.getReferencesTo("color.red")         // each place {color.red} is typed in the files, with the tokens that have it
```

### What a read gives you

| | What it is |
| --- | --- |
| `files`, `entryFile`, `getText(file)` | Every file the read used, the one it started from, and a file's text exactly as read |
| `resolver` | What the resolver document says about itself: its sets, and its modifiers with their contexts and defaults |
| `permutations`, `getPermutation(input)` | Every permutation built, and one by its input. `getPermutation()` gives the default |
| `getTokenPaths()`, `getGroupPaths()`, `has(path)` | Every token and group path, and whether a path is there, in any permutation |
| `getDefinitions(path)` | Every place a token or group is written in the files, each with the permutations that read it and the ones its value wins in |
| `getReferencesTo(path)` | Every reference to a path typed in the files, each place once, with the tokens that have it and the permutations it holds in: what renaming it rewrites, and whether anything uses it at all |
| `sources` | Every source the resolver lists, once |
| `diagnostics`, `getDiagnostics(path)` | Every problem, or those about one token or group, each with the permutations it holds in |
| `reread(changed)`, `rereadAll(files)`, `getChangesSince(before)` | New tokens after files changed, and what changed |
| `toMemory()` | The entry file and every file's text, to read the same tokens somewhere else |
| `parseOptions` | How the read read values, such as whether it took hex strings: give it to `parseValue` to read another value, such as one inside `$extensions`, the same way |

### A token

| | What it is |
| --- | --- |
| `path`, `type` | Its path and its type |
| `value`, `resolved` | Its value as written, with references kept, and its resolved value. `isReference(token.value)` (from `@sugarcube-sh/dtcg`) tells a reference from a value |
| `invalid` | Set when its value couldn't be read |
| `description`, `deprecated`, `extensions` | Its `$description`, `$deprecated` and `$extensions` |
| `references`, `getReferenceAt(property)`, `aliasChain` | The references its value writes, and every token it passes through to resolve |
| `winningDefinition`, `definitions`, `asWritten` | Where its value comes from, every place it's written, and what that file wrote. `getSpan(tokens, place)` gives a place's position in the file, `getJsonPath(tokens, place)` its path in the JSON |
| `inherited`, `generated` | Set when it's there because of `$extends`, or a generator made it |
| `parts` | Each part of a composite value, each shadow layer or gradient stop, with what it resolved to |

### `askEveryPermutation(tokens, question)`

Asks `question` of every permutation. Each different answer comes back once, as
`{ answer, permutations }`, with the permutations that gave it. If there's only one answer, it's
the same everywhere.

Two answers count as the same when they're the same value, or lists of the same values in the same
order. A token that's the same in two permutations is the same object in both, so
`(p) => p.getToken(path)` groups them too.

### A list of permutations

`tokens.permutations` is a list of permutations. So is the `permutations` on an answer from
`askEveryPermutation`, on a problem, and on a change. Each is a normal read-only array, plus:

| | What it is |
| --- | --- |
| `label` | Which permutations it holds, for people, such as `mode: dark` or `everywhere` |
| `inputs`, `scope` | Their inputs, and which contexts they cover, for writing your own label |
| `others` | Every permutation the read built that it doesn't hold, itself a list: none when it holds them all |
| `select(test)`, `findByInput(input)` | The ones that pass a test, as a list of their own, and the one an input picks |

### Errors

| | Thrown by |
| --- | --- |
| `PermutationError` | `tokens.getPermutation(input)` when no permutation fits the input; `detail` says why |
| `SeveralPermutationsError` | A question of one permutation asked of `tokens` with several; `detail` has an example input |

### Working with token paths

A token's path is its group names and its own name, joined with dots: `color.brand.500`. The spec
has rules that are easy to get wrong by hand: the top of a file is a group, whose path is `""`, a
`$root` token stands for its group, and `color.brandy` isn't inside `color.brand`. `tokenPath`
follows them.

```ts
import { tokenPath } from "@sugarcube-sh/dtcg";

tokenPath.getParent("color.brand.500")               // "color.brand"; "" for a name at the top level
tokenPath.getName("color.brand.500")                  // "500"
tokenPath.join("color.brand", "500")                  // "color.brand.500"; join("", "color") is "color"
tokenPath.relative("color", "color.brand.ink")        // "brand.ink"; undefined when it isn't inside
tokenPath.contains("color.brand", "color.brand.500")  // true, and for "color.brand" itself
tokenPath.removeRoot("color.accent.$root")            // "color.accent", the name a $root token stands for
tokenPath.findInvalidCharacter("brand.500")           // ".", which no name may hold; undefined when no character is wrong
tokenPath.findNameProblem("a.b")                      // { character: "." }; {} for an empty name; undefined when it's valid
tokenPath.isValidName("")                             // false: a name can't be empty, or hold one of those characters
tokenPath.applyMoves("color.brand.500", [{ from: "color.brand", to: "color.house" }])
                                                      // "color.house.500", where it is after a rename
```

If a token was renamed, tell `getChangesSince` what moved: `after.getChangesSince(before, { moved })`.
Then it says the token was renamed, instead of one token removed and another added. A reference's
`moved(moves)` gives how it should be written after the rename.

### Positions in the text, for editors

From `@sugarcube-sh/dtcg/editor`, each asked of the read:

| | What it gives |
| --- | --- |
| `getSpan(tokens, place)` | Where a place or reference is written: its file, and where it starts and ends, as TypeScript's `TextSpan` or an LSP `Range` |
| `getJsonPath(tokens, place)` | The keys leading to it in its file, such as `["color", "text"]`, as jsonc-parser's `JSONPath` |
| `getJsonAt(tokens, file, jsonPath)` | What the file writes at those keys, exactly as written |
| `getDiagnosticsAt(tokens, place)` | The problems at a place in a file, or at a point, such as the cursor |

### Writing files

For a tool that writes token files, beside `getJsonPath` and `getJsonAt` (`/editor`):

| Import from | | What it does |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `getFilePath(entryFile, file)` | Where a file the read names really is: `getFilePath("tokens/tokens.resolver.json", "dark.json")` is `"tokens/dark.json"` |
| `@sugarcube-sh/dtcg/node` | `getAbsoluteFilePath(entryFile, file)` | The same, as an absolute path on disk |
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
| `@sugarcube-sh/dtcg` | `toInputLabel(input)` | An input written as a label, as permutations are labelled: `mode: dark, size: small` |
| `@sugarcube-sh/dtcg/css` | `toCSSIdentifier(path)` | The identifier CSS builds names from: `color-brand-500`, before `--` or any prefix |
| | `toCustomPropertyName(path)` | The custom property for a path, ready for a stylesheet: `--color-brand-500` |
| | `createCSSWriter(options)` | A writer with your own opinions: naming, such as a prefix, fallbacks, and which tokens to leave out. Pass it to `getCSSBlocks` |

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
| `findResolver(paths)` | Looks for the resolver document among files and folders: `{ kind: "one", path }`, `{ kind: "several", paths }`, or `{ kind: "none" }` |
| `findTokenFiles(paths)` | Looks for token files among files and folders: `{ tokenFiles, otherFiles }`, where a token file ends `.json` or `.tokens` and uses a property from the spec, such as `$value` or `$type` |
| `onFileChanged(watcher, listener)` | Calls `listener` for each file a watcher says was saved |

### What's where

| Import from | For | Runs in |
| --- | --- | --- |
| `@sugarcube-sh/dtcg` | `read` with your own `readText`, `readFromMemory`, `askEveryPermutation`, `tokenPath`, the errors, and every type | anywhere |
| `@sugarcube-sh/dtcg/node` | `read` from disk, `createLiveTokens`, `findResolver`, `findTokenFiles` | Node |
| `@sugarcube-sh/dtcg/css` | CSS custom properties, values and stylesheets | anywhere |
| `@sugarcube-sh/dtcg/editor` | where things are in the text, for editors and tools that write files | anywhere |
| `@sugarcube-sh/dtcg/values` | checking one value, and the spec's lists | anywhere |

## License

MIT. See [LICENSE.md](./LICENSE.md).
