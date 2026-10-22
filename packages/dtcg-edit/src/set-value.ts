import type { DesignTokens, JsonPath, JsonValue } from "@sugarcube-sh/dtcg";
import { isJsonObject, readReference } from "@sugarcube-sh/dtcg/values";
import { refused } from "./error-messages.js";
import type { FileOp, OpResult, Refusal, ValueOptions } from "./index.js";
import { asked, ownProperties, placement } from "./placement.js";
import { opsAt } from "./file-text.js";
import { propertyEdit } from "./property.js";

/**
 * Changes a token's value.
 *
 * Without an `input`, the shared value changes: one edit where a file every permutation reads
 * writes the token, seen by every context that doesn't override it. With an `input`, such as
 * `{ mode: "dark" }`, that context's own value changes: its override is edited, or one is added
 * to a file that context reads and the others don't; when there are several such files, and not
 * exactly one of them declares the token's group, the answer is a placement {@link Question}. A
 * context at its default counts as none. A later file replaces a token whole (Resolver 3.3), so a
 * new override also writes what the token says itself: its own `$type`, `$description`,
 * `$deprecated` and `$extensions`, not those it takes from a group.
 *
 * With `at`, a place from `tokens.writtenAt(path)`, the value written at that place changes
 * instead, whichever contexts read it.
 *
 * With `part`, only that part of the value changes, such as a shadow's `["color"]`, and every
 * other part stays as the file writes it. A part takes a value or a reference, as the spec allows:
 * "Sub-values may be explicit values (e.g. `color` values) or references to other design tokens
 * that have the sub-value's type" (Format 9).
 *
 * The value is written exactly as given, keeping the file's own spelling; use `toDTCGValue`
 * from `@sugarcube-sh/dtcg` to write a value taken from the model. A value the read finds wrong,
 * such as a reference to a token not made yet, is still written, and the read reports it.
 *
 * Refused, with the reason: a token that doesn't exist, one a generator makes, one a group
 * inherits through `$extends`, an override for two contexts at once, a context with no whole
 * file of its own, an override a file read later would hide, a shared value when every
 * context writes its own, a place `at` where the token isn't written, a `part` with a reference
 * to another token on the way to it, or a `part` the value has nowhere to put.
 *
 * @example
 * setValue(tokens, "color.danger", "{color.red.600}")
 * setValue(tokens, "color.danger", "{color.red.400}", { input: { mode: "dark" } })
 * const dark = tokens.writtenAt("color.danger").find(({ span }) => span.file === "dark.json");
 * if (dark) setValue(tokens, "color.danger", "{color.red.400}", { at: dark.span });
 * setValue(tokens, "shadow.raised", "{color.neutral.900}", { part: [1, "color"] })
 */
export function setValue(
    tokens: DesignTokens,
    path: string,
    value: JsonValue,
    options: ValueOptions = {},
): OpResult {
    return setValueIn(tokens, path, value, options);
}

function setValueIn(
    tokens: DesignTokens,
    path: string,
    value: JsonValue,
    options: ValueOptions,
    place?: string,
): OpResult {
    const placed = placement(tokens, path, options, place);
    if ("choose" in placed) {
        return asked(placed.choose, (file) => setValueIn(tokens, path, value, options, file));
    }
    if ("refused" in placed) return placed;
    const part = options.part ?? [];
    if ("at" in placed) {
        const { at, alsoAffects } = placed;
        const whole = isJsonObject(at.written) ? at.written.$value : undefined;
        const checked = withPart(path, whole, part, value);
        if ("refused" in checked) return checked;
        return { ops: opsAt(tokens, at, ["$value", ...part], value), alsoAffects, moved: [] };
    }
    const { token, into, alsoAffects } = placed;
    const own = ownProperties(token);
    const made = withPart(path, own.$value, part, value);
    if ("refused" in made) return made;
    const override = { ...own, $value: made.value };
    const op: FileOp = {
        kind: "add",
        file: into,
        jsonPath: path.split("."),
        value: override,
    };
    return { ops: [op], alsoAffects, moved: [] };
}

function withPart(
    path: string,
    whole: JsonValue | undefined,
    part: JsonPath,
    value: JsonValue,
    from = 0,
): { value: JsonValue } | { refused: Refusal } {
    if (from === part.length) return { value };
    if (readReference(whole)) return refused({ kind: "part-in-reference", path, part });
    const step = part[from];
    if (
        Array.isArray(whole) &&
        typeof step === "number" &&
        Number.isInteger(step) &&
        step >= 0 &&
        step < whole.length
    ) {
        const made = withPart(path, whole[step], part, value, from + 1);
        if ("refused" in made) return made;
        return { value: whole.map((each, index) => (index === step ? made.value : each)) };
    }
    if (isJsonObject(whole) && typeof step === "string") {
        const made = withPart(path, whole[step], part, value, from + 1);
        if ("refused" in made) return made;
        return { value: { ...whole, [step]: made.value } };
    }
    return refused({ kind: "no-such-part", path, part });
}

/**
 * Changes a token's description in every file that writes the token, so every context keeps the
 * same one, or a group's in the file that writes it. `null` removes it; removing one that isn't
 * there changes nothing. A group that takes its description from the group it extends is given
 * its own, as the spec allows: "Replace any inherited tokens/properties where local ones exist"
 * (Format 6.4.2).
 *
 * Refused, with the reason: a path that is neither a token nor a group, a token a generator
 * makes, or a token or group there only because of `$extends`.
 *
 * @example
 * setDescription(tokens, "color.brand", "The house colour.")
 */
export function setDescription(
    tokens: DesignTokens,
    path: string,
    description: string | null,
): OpResult {
    return propertyEdit(tokens, path, "$description", description);
}
