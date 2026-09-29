// Switches a set of colors from one palette to another, such as every button color from blue to
// violet. Each color keeps its step, so 500 stays 500, in every theme that sets it. The whole
// switch is one undo step: if any part is refused, nothing changes.
import { acrossPermutations, isAlias, tokensIn } from "@sugarcube-sh/dtcg";
import { setValues, type Session, type ValueOptions } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;

const from = "color.blue";
const to = "color.violet";

function swapped(value: unknown): string | undefined {
    if (!isAlias(value) || !value.alias.startsWith(`${from}.`)) return undefined;
    return `{${to}${value.alias.slice(from.length)}}`;
}

const doc = session.project.doc;
const changes: ({ path: string; value: string } & ValueOptions)[] = [];
for (const t of tokensIn(doc, "color.button")) {
    const base = swapped(t.value);
    if (base) changes.push({ path: t.path, value: base });

    for (const { input, token, overrides } of acrossPermutations(doc, t.path)) {
        const value = overrides ? swapped(token.value) : undefined;
        if (value) changes.push({ path: t.path, value, context: input });
    }
}

const done = session.do(setValues(session.project, changes));
if ("refused" in done) showMessage(done.refused.reason);
