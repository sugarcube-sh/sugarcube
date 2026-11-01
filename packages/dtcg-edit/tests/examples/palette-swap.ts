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
    const whole = t.referenceAt();
    if (whole?.path === undefined || tokenPath.relative(oldPalette, whole.path) === undefined)
        return undefined;
    return whole.moved(swap);
}

const tokens = session.tokens;
const changes: ({ path: string; value: JsonValue } & ValueOptions)[] = [];
for (const t of tokens.permutation().group("color.button")?.tokens ?? []) {
    for (const { span, winsIn } of tokens.writtenAt(t.path)) {
        const there = winsIn[0]?.token(t.path);
        const value = there && swapped(there);
        if (value) changes.push({ path: t.path, value, at: span });
    }
}

const done = session.do(setValues(session.tokens, changes));
if (done.refused) showMessage(done.refused.reason);
