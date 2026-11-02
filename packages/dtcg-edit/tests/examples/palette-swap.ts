// Switches a set of colors from one palette to another, such as every button color from blue to
// violet. Each color keeps its step, so 500 stays 500, in every theme that sets it. The whole
// switch is one undo step: if any part is refused, nothing changes.
import { type Token, type JsonValue, tokenPath } from "@sugarcube-sh/dtcg";
import { setValues, type Session, type ValueOptions } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;

const oldPalette = "color.blue";
const newPalette = "color.violet";
const swap = [{ from: oldPalette, to: newPalette }];

function swapped(t: Token): JsonValue | undefined {
    const whole = t.getReferenceAt();
    if (
        whole?.pointsToPath === undefined ||
        tokenPath.relative(oldPalette, whole.pointsToPath) === undefined
    )
        return undefined;
    return whole.moved(swap);
}

const tokens = session.tokens;
const changes: ({ path: string; value: JsonValue } & ValueOptions)[] = [];
for (const t of tokens.getPermutation().getGroup("color.button")?.tokens ?? []) {
    for (const { span, winsIn } of tokens.getDefinitions(t.path)) {
        const there = winsIn[0]?.getToken(t.path);
        const value = there && swapped(there);
        if (value) changes.push({ path: t.path, value, at: span });
    }
}

const done = session.do(setValues(session.tokens, changes));
if (done.refused) showMessage(done.refused.reason);
