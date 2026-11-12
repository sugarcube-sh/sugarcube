import type { DesignTokens, JsonValue } from "@sugarcube-sh/dtcg";
import { refused } from "./error-messages.js";
import type { Clash, ClashPart, FileOp, OpResult } from "./index.js";
import { isGone } from "./clashes.js";
import { seenReading } from "./placement.js";

/**
 * Settles a {@link Clash} by keeping your side: what your step wrote is written over theirs at
 * every part it changes, expecting theirs, as an edit like any other to commit with
 * {@link Session.do}; a part you removed is removed. Refused (`gone-elsewhere`) when the clash
 * isn't {@link Clash.keepable}: a part was removed or renamed since, and in a file a rename looks
 * the same as a removal, so yours isn't written over something else. Keeping theirs needs no edit:
 * the files already show it.
 *
 * @example
 * for (const clash of session.rebase(fresh)) {
 *     if (clash.keepable && (await askKeepYours(clash))) {
 *         session.do(keepYours(session.tokens, clash));
 *     }
 * }
 */
export function keepYours(tokens: DesignTokens, clash: Clash): OpResult {
    const gone = clash.parts.find(isGone);
    if (gone) {
        return refused({
            kind: "gone-elsewhere",
            file: gone.file,
            ...(gone.path !== undefined && { path: gone.path }),
        });
    }
    const parts = clash.parts.filter(hasTheirs);
    return {
        ops: parts.map((part) => opFor(tokens, part)),
        alsoAffects: seenReading(
            tokens,
            parts.map((part) => part.file),
        ),
        moves: [],
    };
}

function hasTheirs(part: ClashPart): part is ClashPart & { theirs: JsonValue } {
    return !isGone(part);
}

function opFor(
    tokens: DesignTokens,
    { file, jsonPath, yours, theirs }: ClashPart & { theirs: JsonValue },
): FileOp {
    if (yours === undefined && jsonPath.length === 0) {
        return { kind: "deleteFile", file, was: tokens.getText(file) as string };
    }
    if (yours === undefined) return { kind: "remove", file, jsonPath, was: theirs };
    return { kind: "set", file, jsonPath, value: yours, was: theirs };
}
