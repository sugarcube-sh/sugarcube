import type { DesignTokens, JsonPath, JsonValue, Permutations } from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import { createWriteOps } from "./file-text.js";
import type { FileOp, OperationResult, EditOptions } from "./index.js";
import {
    createQuestion,
    findExtensionPlacement,
    getOwnProperties,
    findPlacement,
} from "./placement.js";

/**
 * Changes one setting in a token's or group's `$extensions`.
 *
 * A token's goes where {@link setValue} writes its value. A group's goes where its extension is
 * written. One inherited through `$extends` becomes the group's own copy.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.primary"`.
 * @param jsonPath - The setting, starting with the extension's key, such as
 *   `["com.example", "contrast"]`. The key alone replaces the whole extension.
 * @param value - The new value, written as passed, such as `"AA"`, or `null` to remove it.
 * @param options - Where the change goes.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#extensions | Format 5.2.3, Extensions}
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#extending-groups | Format 6.4, Extending Groups}
 *
 * @example
 * // A setting of your own on color.primary
 * setExtension(tokens, "color.primary", ["com.example", "contrast"], "AA").ops
 * // => [{ kind: "add", file: "color.json",
 * //       jsonPath: ["color", "primary", "$extensions", "com.example", "contrast"], value: "AA" }]
 */
export function setExtension(
    tokens: DesignTokens,
    path: string,
    jsonPath: readonly [string, ...JsonPath],
    value: JsonValue | null,
    options: EditOptions = {},
): OperationResult {
    return setExtensionInFile(tokens, path, jsonPath, value, options);
}

function setExtensionInFile(
    tokens: DesignTokens,
    path: string,
    jsonPath: readonly [string, ...JsonPath],
    value: JsonValue | null,
    options: EditOptions,
    chosenFile?: string,
): OperationResult {
    const placement = findSettingPlacement(tokens, path, jsonPath, options, chosenFile);
    if ("choice" in placement) {
        return createQuestion(placement.choice, (file) =>
            setExtensionInFile(tokens, path, jsonPath, value, options, file),
        );
    }
    if ("refusal" in placement) return placement;
    const { affectedPermutations } = placement;
    if ("at" in placement) {
        const { at, currentExtension } = placement;
        if (currentExtension === undefined) {
            return {
                ops: createWriteOps(tokens, at, ["$extensions", ...jsonPath], value),
                affectedPermutations,
                moves: [],
            };
        }
        const [key, ...settingPath] = jsonPath;
        const newExtension = replaceSetting(currentExtension, settingPath, value);
        const ops =
            newExtension === currentExtension
                ? []
                : createWriteOps(tokens, at, ["$extensions", key], newExtension ?? null);
        return { ops, affectedPermutations, moves: [] };
    }
    const { into, current, settingPath } = placement;
    const newExtension = replaceSetting(current, settingPath, value);
    const ops: FileOp[] =
        newExtension === current || newExtension === undefined
            ? []
            : [{ kind: "add", file: into, jsonPath: placement.jsonPath, value: newExtension }];
    return { ops, affectedPermutations, moves: [] };
}

type SettingPlacement =
    | Exclude<ReturnType<typeof findExtensionPlacement>, { into: string }>
    | {
          into: string;
          jsonPath: JsonPath;
          current: JsonValue | undefined;
          settingPath: JsonPath;
          affectedPermutations: Permutations;
      };

function findSettingPlacement(
    tokens: DesignTokens,
    path: string,
    [key, ...settingPath]: readonly [string, ...JsonPath],
    options: EditOptions,
    chosenFile: string | undefined,
): SettingPlacement {
    const pathKeys = path.split(".");
    if (!tokens.permutations.some((perm) => perm.getToken(path))) {
        const placement = findExtensionPlacement(tokens, path, key, options, chosenFile);
        if (!("into" in placement)) return placement;
        const { into, currentExtension, affectedPermutations } = placement;
        return {
            into,
            jsonPath: [...pathKeys, "$extensions", key],
            current: currentExtension,
            settingPath,
            affectedPermutations,
        };
    }
    const placement = findPlacement(tokens, path, options, chosenFile);
    if (!("token" in placement)) return placement;
    const { into, token, affectedPermutations } = placement;
    const own = getOwnProperties(token);
    return {
        into,
        jsonPath: pathKeys,
        current: own,
        settingPath: ["$extensions", key, ...settingPath],
        affectedPermutations,
    };
}

function replaceSetting(
    whole: JsonValue | undefined,
    jsonPath: JsonPath,
    value: JsonValue | null,
): JsonValue | undefined {
    const [step, ...rest] = jsonPath;
    if (step === undefined) return value ?? undefined;
    if (Array.isArray(whole) && typeof step === "number") {
        if (!Number.isInteger(step) || step < 0 || step >= whole.length) return whole;
        const changed = replaceSetting(whole[step], rest, value);
        if (changed === whole[step]) return whole;
        return changed === undefined
            ? whole.filter((_, index) => index !== step)
            : whole.map((each, index) => (index === step ? changed : each));
    }
    const key = String(step);
    const object = isJsonObject(whole) ? whole : undefined;
    const now = object?.[key];
    if (value === null && now === undefined) return whole;
    const changed = replaceSetting(now, rest, value);
    if (changed === now) return whole;
    if (changed !== undefined) return { ...object, [key]: changed };
    return Object.fromEntries(Object.entries(object ?? {}).filter(([each]) => each !== key));
}
