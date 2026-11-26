---
"@sugarcube-sh/cli": minor
"@sugarcube-sh/vite": minor
---

sugarcube 0.2 is a rebuild. It reads your token files exactly as the [DTCG 2025.10 spec](https://www.designtokens.org/TR/2025.10/) describes, and when something's wrong, it tells you where, and how to fix it.

Most projects upgrade without changing anything. But the last version quietly turned some mistakes into broken CSS, and those are now errors. So the first thing to do is check your tokens.

## ✅ Upgrading

You'll need Node 22.14 or later, and Vite 7 or 8 if you use the Vite plugin.

1. Save a copy of the CSS sugarcube writes now, so you can compare it afterwards.
2. Update the packages you use:

   ```sh
   npm install -D @sugarcube-sh/cli@latest
   npm install -D @sugarcube-sh/vite@latest
   ```

3. Check your tokens:

   ```sh
   npx sugarcube validate
   ```

   It lists every problem at once, with the file and line it's on, and what to write instead.

4. Build, and compare the CSS with your copy. The rest of these notes explain each kind of difference you might see.

## ⚠️ What might need a change from you

### Mistakes that used to slip through now stop the build

The last version accepted some mistakes and wrote broken CSS without telling you. A token named `$brand` just disappeared. A modifier with no default quietly used its first context. Now each one is an error: the CLI writes no CSS, and `vite build` fails. (While you're working in Vite's dev server, your last good CSS stays on the page.)

Every error says what's wrong and where:

```text
base.json:6:7  error[misspelt-property]
  `$descripton` is not a token property
  6 |       "$descripton": "body text"
    |       ^^^^^^^^^^^^^ did you mean `$description`?
```

These are the ones you're most likely to have:

- **A typography token without all five parts.** The spec needs `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing` and `lineHeight`. The error names the ones that are missing.
- **A modifier with no `default`.** Add `"default"` with the context you want, such as `"light"`. (You don't need one if your config lists `variables.permutations`.)
- **A file listed straight in `resolutionOrder`.** Its tokens were left out of your CSS. Put the file in a set's `sources` instead, and its tokens reach your CSS for the first time.
- **A colour's `hex` that isn't six digits,** such as `"hex": "#fff"`. Write all six. Transparency goes in `alpha`.
- **Two tokens that make the same CSS variable,** such as `color.brand-primary` and `color.brand.primary`. Only one of them ever reached your CSS. Rename one.
- **`fluid: false`.** Leave `fluid` out for a size that doesn't scale.
- **A misspelt `$value`,** such as `$vlaue`, or `value` without the `$`. The token used to vanish.

Some values used to finish the build but write CSS that didn't work, and they now stop it too. For example, a reference where only a plain value is allowed, an empty font list, or a reference to a token of the wrong type. There are also some rarer forms the spec doesn't allow, such as a name starting with `$`, `$extends` without braces, or a key the spec doesn't define (put your own data in `$extensions`). The error tells you what to write for each one.

### Gradient variables only contain their stops

A gradient token used to come out as a whole `linear-gradient()`. But a gradient token doesn't say whether it's linear, radial or conic, or which way it goes. So now its variable just has the colours and their positions, and you choose the gradient:

```css
/* Before */
--fade: linear-gradient(#ffffff 0%, #000000 100%);

/* Now */
--fade: #ffffff 0%, #000000 100%;
```

Wrap each place you use it:

```css
.hero {
  background-image: linear-gradient(to right, var(--fade));
}
```

A use you don't wrap won't draw anything, and nothing warns you. So search your CSS for each gradient variable.

### Some utility classes are no longer made

- **`background-image` classes from gradient tokens,** for the same reason: sugarcube can't know which gradient you want. Write the class yourself, such as `.bg-fade { background-image: linear-gradient(to right, var(--fade)); }`.
- **`text-shadow` classes.** A DTCG shadow always has a `spread`, which `text-shadow` doesn't accept, so browsers ignored every one of these classes anyway.
- **Typography classes.**

In each case, sugarcube warns you, so you'll know which entry in your config makes nothing.

### Theme blocks are longer

A theme now works on any element, not only `<html>` (see the highlights below). To make that work, each theme block also writes the variables that depend on the ones it changes, so the blocks are a little longer.

If you only ever put themes on `<html>` and want the shorter CSS, turn it off:

```ts
export default defineConfig({
  variables: { redeclareDependents: false },
});
```

### Three flags were removed or renamed

- `generate --force` is gone. It never did anything, so remove it from your scripts.
- `components --overwrite` is now `components --force`, and `-o` is short for `--output`, as on `cube`.
- `cube -f` is gone. Use `cube --force`.

### Your config is checked more closely

- A setting sugarcube doesn't know is now an error, such as `` `varibles` is not a setting ``. Before, a misspelt setting was ignored, so you quietly got its default.
- A `sugarcube.config.ts` that exports nothing is an error.
- `--fluid-min` and `--fluid-max` must be numbers.
- studio's old `colorScale` and `panel` settings are gone, so remove them from `studio` in your config.
- In TypeScript configs, `VariableNameFn` is now `VariableNameFunction`.

### A colour object is written from its numbers

A colour written as an object, with `components` and a `hex`, is written to CSS from its `components`, even if the `hex` says something different. The spec calls the `hex` a fallback, not the colour. If yours disagree, fix the `hex`. Colours written as a hex string, such as `"#e11d48"`, are written exactly as before.

### `validate` asks for a resolver when you give it several token files

`sugarcube validate tokens/` with several token files and no resolver now asks you for one, because only a resolver says which file wins when two write the same token. Before, it read them together in path order.

### A resolver in a hidden folder isn't found on its own

sugarcube no longer looks inside hidden folders, such as `.storybook` or `.tokens`, when it searches for your resolver. If yours is in one, name it in your config with `resolver`.

### If a script reads sugarcube's output

- Every message is worded differently, so check any patterns your scripts match.
- `analyze` exits with code 1 when your tokens have errors, as `lint` does. With `--json`, problems go to stderr.
- `analyze impact --json`: `type` is replaced by `definitions`, one entry per place the token is written, and `consumers` is now `uses`.
- `analyze unused --json`: `scanned.forVarReferences` and `scanned.forUtilityClasses` are now `scanned.stylesheets` and `scanned.markup`.
- `lint --json`: `noFallback` and `fallback` are now `withoutFallback` and `withFallback`.

## 👀 Highlights

### Every mistake, with where it is

When something's wrong, sugarcube lists every problem at once. Each one starts with the file, line and column, which most terminals and editors let you click. It shows the line from your file, marks the problem, and suggests a fix when there's a clear one, including "did you mean" for a misspelt reference or `$extends` target:

```text
base.json:5:17  error[invalid-value]
  a dimension can't be a string
  5 |       "$value": "16px"
    |                 ^^^^^^ write `{ "value": 16, "unit": "px" }`
```

A problem that only affects some of your themes says which ones, such as "in mode: dark". And a mistake in `sugarcube.config.ts` names the setting and what it should be, where it used to say "Invalid input".

### Themes work on any element

Put a theme on a section or a card, not only on `<html>`, and everything inside it changes, including tokens that refer to the ones the theme sets:

```html
<html data-theme="light">
  <section data-theme="dark">
    </section>
</html>
```

Combined and nested themes work too: dark mode and a brand on the same element, or a light section inside a dark page.

### Watch mode and Vite keep going through mistakes

`generate --watch` and the Vite plugin no longer stop when a file is broken, even when it's broken at start-up. They show the problem, keep your last good CSS (or write none, if there wasn't any yet), and build again as soon as you fix it. They also pick up changes to `sugarcube.config.ts` without a restart, and watch exactly the token files your resolver uses. New tokens get their utility classes in Vite without a restart.

### See what a change would affect

`sugarcube analyze impact color.neutral.900` shows every token that refers to it, as a tree, and every CSS and markup file that uses each one:

```text
color.neutral.900                      0
├─ color.neutral.on.loud               7   css/badge.css  react/badge.css  +5 more
│  └─ color.on.loud                    8   css/badge.css  react/badge.css  +6 more
└─ color.neutral.text.normal           0
   └─ color.text.normal               28   accordion.css  dropdown-menu.css  +9 more
```

### More of the spec, and more control over names

- Every DTCG colour space is written to CSS, from `oklch()` and `lab()` to Display P3 and Rec 2020.
- New `variables.case` and `variables.delimiter` settings, for names like `--color_brandPrimary`.
- Comments and trailing commas are allowed in your resolver.

## 👉 Everything else

### Fixes

- A shadow list that refers to a shadow token, a gradient that refers to another gradient, a whole typography reference, and a line height of `0` all write working CSS now.
- A dash pattern is written as `dashed`.
- Font names that start with a digit, match a CSS keyword, or contain a quote are quoted correctly.
- Numbers come out as you wrote them, with no `30.000000000000004%`.
- Gradient stops stay between 0% and 100%.
- Variable names browsers would drop are escaped, such as `--space-1\/2`, in your variables and utility classes.
- Tokens come out in the order you wrote them. Whole-number names like `space.100` no longer jump to the top of their group.
- A token that refers to a private composite token keeps the `var()`s inside it.
- A theme block whose selector isn't `:root` no longer misses variables it shares with the first block.
- Fluid sizes are worked out the same way as Utopia's calculator, and a size that shrinks as the screen gets wider works.
- A token that refers to a private fluid size is fluid too, and a fluid size with its own range keeps it when its value is a reference.
- With the `polyfill` colour fallback: transparency is kept, every colour space except sRGB and HSL gets a fallback (inside shadows and gradients too), and a later theme only writes what changed.
- Utility classes come in your config's order, each shorthand before its longhands, so `px-4 pl-0` really has no left padding.
- Two utility entries with the same prefix both keep their directions.
- More tokens get utility classes: paths that mix hyphens and dots, tokens only some themes define, `$root` tokens, names with spaces, `line-height` from dimension tokens and `font-weight` from number tokens.
- A utility entry without a `prefix` can use `directions` and `stripDuplicates`.
- A utility `source` without `*` gives you the tokens under it, as `.*` does. A `source` naming a single token, such as `"space.gutter"`, now makes no classes and warns. It used to give every class that one token's value.
- Settings beside a `$ref` in your resolver work, so `"default": "dark"` there makes dark the default.
- A group written across several files is merged setting by setting, instead of the last file replacing the others.
- A reference with no type takes the type of the token it points to.
- `$extensions` next to `$extends` are merged with the ones it brings in. And a token's `$ref` takes only the value it points to, not the other token's `$description` and `$extensions`.
- Marking a set private keeps all of its files out of your CSS.
- Permutation inputs in your config match whatever their case.
- A token file that can't be read is one problem, not one for every reference into it.
- A problem in a token file that your resolver names by its full path shows the right file.
- `generate --resolver` wins when several resolvers could be found.
- `validate` with no paths checks what `generate` builds. It also reads `.tokens` files, skips `node_modules` and hidden folders, and no longer mistakes `package.json` for a token file.
- A save that lands while a file is being read no longer leaves watch mode or Vite stuck with a half-written file.
- On Linux, each save is built and reloaded once, not twice.
- Deleting `sugarcube.config.ts` while watching is reported, and it's read again when it's back. Before, watch mode wrote CSS to the default paths.
- An edit to `sugarcube.config.js` is picked up while watching, and a mistake in it is reported.
- The Vite plugin finds `sugarcube.config.ts` in Vite's root, so it works from the top of a monorepo. Tools that only load your Vite config, such as Vitest, no longer trigger a read.
- `lint` no longer flags variables your utility classes set.
- `components` runs your package manager once, and writes each file once.

### Newly accepted

A byte order mark at the start of a file, JSON Pointers into part of a value, `$`, `.`, `{` and `}` in set and modifier names, settings next to a set's `$ref` in a list of sources, `$deprecated` on a group, a later file changing a token's `$type`, types and `$extends` that reach across files, a `$root` token written with `$ref`, `$extends` at the top of a token file, and `directions: "x"` written as one string.

### New warnings

None of these change your CSS:

- A property a value's type doesn't have, such as Figma's `paragraphSpacing` in a typography token. The rest of the token is written as before.
- A key written twice in the same object.
- A reference to a token marked `$deprecated`, with the reason it gives.
- A token name with a space at the start or end.
- A theme file whose default theme isn't its first block.
- Fluid text that can't be zoomed to 200%, which WCAG 1.4.4 asks for.
- A `polyfill` colour with no `hex`.
- A `$` key the spec doesn't define next to a file's tokens, such as `$metadata`. It's still ignored.
- Two tokens making the same utility class, a utility entry that makes no classes (and why), a utility entry whose classes an earlier entry already makes, and a `safelist` name that matches no token.

### Deprecated

These still work, with a warning, and will stop working in a later release:

- `colorFallbackStrategy: "polyfill"` and `--color-fallback polyfill`
- `directions: "full"` in utilities. Use `"all"`.
- `propagateDependents`. It's now called `redeclareDependents`.

`prefersColorScheme: true` in a modifier's `$extensions` no longer warns. It already did nothing, so remove it, and use `variables.permutations` with an `atRule` for a `prefers-color-scheme` block instead.

### For Vite plugin authors

`api.getContext()` now gives you `config`, `configProblems`, `tokens` and `onReload`. Everything else it gave is gone, and so is the `extractTokenDirs` export. Its `config` is read-only, so TypeScript stops a plugin from changing the config sugarcube builds with. `DEBUG=sugarcube` times each save.
