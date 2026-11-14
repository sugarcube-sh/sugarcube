import type { DesignTokens, JsonValue } from "@sugarcube-sh/dtcg";
import { refuse } from "./error-messages.js";
import type { Clash, ClashPart, FileOp, OperationResult } from "./index.js";
import { isGone } from "./clashes.js";
import { findAffectedPermutations } from "./placement.js";

/**
 * Settles a {@link Clash} by keeping your side.
 *
 * It returns edits that write yours over theirs, for {@link Session.do}. Keeping theirs needs no
 * edit.
 *
 * @param tokens - The session's design tokens, such as `session.tokens`.
 * @param clash - A clash from {@link Session.rebase} or {@link Session.restore}.
 *
 * @example
 * // You set color.primary to {color.blue.300}. A pull changed it in color.json.
 * keepYours(session.tokens, clash).ops
 * // => [{ kind: "set", file: "color.json", jsonPath: ["color", "primary"],
 * //       value: { $type: "color", $value: "{color.blue.300}" },
 * //       was: { $type: "color", $value: { colorSpace: "srgb", components: [0.2, 0.4, 1] } } }]
 */
export function keepYours(tokens: DesignTokens, clash: Clash): OperationResult {
    const gonePart = clash.parts.find(isGone);
    if (gonePart) {
        return refuse({
            kind: "removed-since",
            file: gonePart.file,
            ...(gonePart.path !== undefined && { path: gonePart.path }),
        });
    }
    const parts = clash.parts.filter(hasTheirs);
    return {
        ops: parts.map((part) => toYourOp(tokens, part)),
        affectedPermutations: findAffectedPermutations(
            tokens,
            parts.map((part) => part.file),
        ),
        moves: [],
    };
}

function hasTheirs(part: ClashPart): part is ClashPart & { theirs: JsonValue } {
    return !isGone(part);
}

function toYourOp(
    tokens: DesignTokens,
    { file, jsonPath, yours, theirs }: ClashPart & { theirs: JsonValue },
): FileOp {
    if (yours === undefined && jsonPath.length === 0) {
        return { kind: "delete-file", file, was: tokens.getText(file) as string };
    }
    if (yours === undefined) return { kind: "remove", file, jsonPath, was: theirs };
    return { kind: "set", file, jsonPath, value: yours, was: theirs };
}
