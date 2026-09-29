# @sugarcube-sh/dtcg-edit

Change design token files written in the [DTCG format](https://www.designtokens.org/) without reformatting them.

The API is types and stubs only. Every function throws "not implemented yet".

Every edit is checked by reading the result with [`@sugarcube-sh/dtcg`](../dtcg). An edit that would break the design system is refused, with the reason. Every edit also records what it expected to find, so replaying edits onto files that changed since, after a `git pull` or from a saved link, reports a conflict instead of overwriting someone else's change.

## Possible entries

| Import from | Holds | Runs in |
| --- | --- | --- |
| `@sugarcube-sh/dtcg-edit` | `open`, the operations, `apply` and `commit`, sessions, and encoding edits as text | anywhere |
| `@sugarcube-sh/dtcg-edit/node` | `open` from disk, and `applyToDisk`, which only writes the design system's own files, all or nothing | Node |
| `@sugarcube-sh/dtcg-edit/text` | edits to one JSON text that change nothing else | anywhere |

## How it works

1. `open` reads a design system and keeps the text of its files. The result is a project.
2. An operation, such as `rename` or `setValue`, returns the file edits it needs. If it can't decide on its own, it returns a question. If it can't be done, it returns a refusal with the reason.
3. `apply` or `commit` makes the edits and returns a new project. The old one is left as it was, so undo is keeping the previous project.

A script can stop there. An editor usually wants more: undo and redo, the list of unsaved changes, saving, and taking in files that changed on disk. `createSession` keeps all of that for you.

## A few examples

Rename a token, updating every reference to it, and write the result to disk:

```ts
import { rename, commit } from "@sugarcube-sh/dtcg-edit";
import { open, applyToDisk } from "@sugarcube-sh/dtcg-edit/node";

const project = await open("tokens/tokens.resolver.json");
const done = commit(project, rename(project, "color.brand", "primary"));
if ("ops" in done) await applyToDisk(project, done.ops);
```

Set a value for the dark theme only. If more than one file could hold it, ask:

```ts
import { setValue, commit } from "@sugarcube-sh/dtcg-edit";

const dark = { theme: "dark" };
let done = commit(project, setValue(project, "color.danger", "#fca5a5", { context: dark }));

if ("decision" in done && done.decision.kind === "placement") {
    const file = await askPerson(done.decision.candidates);
    done = commit(project, setValue(project, "color.danger", "#fca5a5", { context: dark, place: file }));
}
```

Deprecate a token, with a message pointing at its replacement:

```ts
import { deprecate, commit } from "@sugarcube-sh/dtcg-edit";

commit(project, deprecate(project, "color.old", "Use color.primary instead"));
```

Keep an editor's undo history and unsaved changes in a session:

```ts
import { createSession, rename, setValue } from "@sugarcube-sh/dtcg-edit";

const session = createSession(project);
session.do(setValue(session.project, "color.brand", "#f43f5e"));
session.do(rename(session.project, "color.danger", "error"));
session.undo();

for (const change of session.changes()) console.log(change.kind, change.path);
```

Save the unsaved edits in a URL, and put them back later onto files that may have changed since:

```ts
import { encodeEdits, decodeEdits } from "@sugarcube-sh/dtcg-edit";

const saved = await encodeEdits(session.unsaved);

const conflicts = session.restore(await decodeEdits(saved));
if (conflicts.length) console.log(conflicts.map((c) => c.reason));
```

## Reading

To read, check and export tokens without editing them, see [`@sugarcube-sh/dtcg`](../dtcg).

## License

MIT. See [LICENSE.md](./LICENSE.md).
