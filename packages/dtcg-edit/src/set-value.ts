import type { DesignTokens, JsonPath, JsonValue } from "@sugarcube-sh/dtcg";
import { isJsonObject, parseReference } from "@sugarcube-sh/dtcg/values";
import { refuse } from "./error-messages.js";
import type { FileOp, OperationResult, Refusal, ValueOptions } from "./index.js";
import { createQuestion, getOwnProperties, findPlacement } from "./placement.js";
import { createWriteOps } from "./file-text.js";
import { setProperty } from "./property.js";

/**
 * Changes a token's value.
 *
 * With `input`, it adds an override when the context has none. When several files could take the
 * override, a {@link Question} asks which.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token, such as `"button.background"`.
 * @param value - The new `$value`, written as passed, such as `"{color.blue.300}"`.
 * @param options - Where the change goes, and which part of the value.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#ordering | Resolver 6.2, Ordering}
 *
 * @example
 * // button.background in dark only, where it has no override yet
 * setValue(tokens, "button.background", "{color.blue.300}", { input: { mode: "dark" } }).ops
 * // => [{ kind: "add", file: "dark.json", jsonPath: ["button", "background"],
 * //       value: { $type: "color", $value: "{color.blue.300}" } }]
 */
export function setValue(
    tokens: DesignTokens,
    path: string,
    value: JsonValue,
    options: ValueOptions = {},
): OperationResult {
    return setValueInFile(tokens, path, value, options);
}

function setValueInFile(
    tokens: DesignTokens,
    path: string,
    value: JsonValue,
    options: ValueOptions,
    chosenFile?: string,
): OperationResult {
    const placement = findPlacement(tokens, path, options, chosenFile);
    if ("choice" in placement) {
        return createQuestion(placement.choice, (file) =>
            setValueInFile(tokens, path, value, options, file),
        );
    }
    if ("refusal" in placement) return placement;
    const part = options.part ?? [];
    if ("at" in placement) {
        const { at, affectedPermutations } = placement;
        const currentValue = isJsonObject(at.json) ? at.json.$value : undefined;
        const newValue = replacePart(path, currentValue, part, value);
        if ("refusal" in newValue) return newValue;
        return {
            ops: createWriteOps(tokens, at, ["$value", ...part], value),
            affectedPermutations,
            moves: [],
        };
    }
    const { token, into, affectedPermutations } = placement;
    const ownProperties = getOwnProperties(token);
    const newValue = replacePart(path, ownProperties.$value, part, value);
    if ("refusal" in newValue) return newValue;
    const override = { ...ownProperties, $value: newValue.value };
    const op: FileOp = {
        kind: "add",
        file: into,
        jsonPath: path.split("."),
        value: override,
    };
    return { ops: [op], affectedPermutations, moves: [] };
}

function replacePart(
    path: string,
    whole: JsonValue | undefined,
    part: JsonPath,
    value: JsonValue,
    depth = 0,
): { value: JsonValue } | { refusal: Refusal } {
    if (depth === part.length) return { value };
    if (parseReference(whole)) return refuse({ kind: "part-in-reference", path, part });
    const step = part[depth];
    if (
        Array.isArray(whole) &&
        typeof step === "number" &&
        Number.isInteger(step) &&
        step >= 0 &&
        step < whole.length
    ) {
        const newChild = replacePart(path, whole[step], part, value, depth + 1);
        if ("refusal" in newChild) return newChild;
        return { value: whole.map((each, index) => (index === step ? newChild.value : each)) };
    }
    if (isJsonObject(whole) && typeof step === "string") {
        const newChild = replacePart(path, whole[step], part, value, depth + 1);
        if ("refusal" in newChild) return newChild;
        return { value: { ...whole, [step]: newChild.value } };
    }
    return refuse({ kind: "no-such-part", path, part });
}

/**
 * Changes a token's or group's description.
 *
 * A token's is written in every file that writes the token. A group inheriting one through
 * `$extends` gets its own.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.primary"`.
 * @param description - The new `$description`, or `null` to remove it.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#extending-groups | Format 6.4, Extending Groups}
 *
 * @example
 * // color.json and dark.json both write color.primary
 * setDescription(tokens, "color.primary", "The main brand color.").ops?.map((op) => op.file)
 * // => ["color.json", "dark.json"]
 */
export function setDescription(
    tokens: DesignTokens,
    path: string,
    description: string | null,
): OperationResult {
    return setProperty(tokens, path, "$description", description);
}
