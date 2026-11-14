import type { DesignTokens, JsonPath, JsonValue, Permutations } from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import { createWriteOps } from "./file-text.js";
import type { FileOp, OpResult, PlaceOptions } from "./index.js";
import {
    createQuestion,
    findExtensionPlacement,
    getOwnProperties,
    findPlacement,
} from "./placement.js";

/**
 * Changes one setting inside a token's or group's `$extensions`, leaving the rest as written, so
 * other tools' settings are kept: "Tools that process design token files MUST preserve any
 * extension data they do not themselves understand" (Format 5.2.3). `jsonPath` starts with the
 * extension's key; give only the key to replace the whole extension. `null` removes the setting.
 *
 * A token's extensions are written per place, as its value is: without options the shared place
 * changes, with `input` that context's own (a new override is the token's own properties with the
 * setting changed, as {@link setValue} makes one), with `at` the place given. A group's setting is
 * written where its extension is used, since a later file's extension replaces an earlier one's
 * whole; with `input`, a context is given the extension it uses, whole, with the setting changed.
 *
 * The value is written exactly as given. Whether the setting is right is for the read to say, as
 * with any edit. Removing a setting that isn't there changes nothing.
 *
 * A group that takes the extension from the group it extends is given its own copy, whole, with the
 * setting changed, so its other settings are kept: "Replace any inherited tokens/properties where
 * local ones exist" (Format 6.4.2) replaces a key whole, so writing the one setting alone would
 * lose the rest.
 *
 * Refused, with the reason: a path that is neither a token nor a group, a token a generator makes,
 * a token or group there only because of `$extends`, and the refusals {@link setValue} gives for
 * where a value goes.
 *
 * @example
 * setExtension(tokens, "space", ["com.example", "scale", "ratio"], 1.333)
 * const [place] = tokens.getDefinitions("space.gutter");
 * if (place) {
 *   const min = { value: 1.5, unit: "rem" };
 *   setExtension(tokens, "space.gutter", ["com.example", "fluid", "min"], min, { at: place.span });
 * }
 */
export function setExtension(
    tokens: DesignTokens,
    path: string,
    jsonPath: readonly [string, ...JsonPath],
    value: JsonValue | null,
    options: PlaceOptions = {},
): OpResult {
    return setExtensionInFile(tokens, path, jsonPath, value, options);
}

function setExtensionInFile(
    tokens: DesignTokens,
    path: string,
    jsonPath: readonly [string, ...JsonPath],
    value: JsonValue | null,
    options: PlaceOptions,
    chosenFile?: string,
): OpResult {
    const placement = findSettingPlacement(tokens, path, jsonPath, options, chosenFile);
    if ("choice" in placement) {
        return createQuestion(placement.choice, (file) =>
            setExtensionInFile(tokens, path, jsonPath, value, options, file),
        );
    }
    if ("refused" in placement) return placement;
    const { alsoAffects } = placement;
    if ("at" in placement) {
        const { at, currentExtension } = placement;
        if (currentExtension === undefined) {
            return {
                ops: createWriteOps(tokens, at, ["$extensions", ...jsonPath], value),
                alsoAffects,
                moves: [],
            };
        }
        const [key, ...settingPath] = jsonPath;
        const newExtension = replaceSetting(currentExtension, settingPath, value);
        const ops =
            newExtension === currentExtension
                ? []
                : createWriteOps(tokens, at, ["$extensions", key], newExtension ?? null);
        return { ops, alsoAffects, moves: [] };
    }
    const { into, current, settingPath } = placement;
    const newExtension = replaceSetting(current, settingPath, value);
    const ops: FileOp[] =
        newExtension === current || newExtension === undefined
            ? []
            : [{ kind: "add", file: into, jsonPath: placement.jsonPath, value: newExtension }];
    return { ops, alsoAffects, moves: [] };
}

type SettingPlacement =
    | Exclude<ReturnType<typeof findExtensionPlacement>, { into: string }>
    | {
          into: string;
          jsonPath: JsonPath;
          current: JsonValue | undefined;
          settingPath: JsonPath;
          alsoAffects: Permutations;
      };

function findSettingPlacement(
    tokens: DesignTokens,
    path: string,
    [key, ...settingPath]: readonly [string, ...JsonPath],
    options: PlaceOptions,
    chosenFile: string | undefined,
): SettingPlacement {
    const pathKeys = path.split(".");
    if (!tokens.permutations.some((perm) => perm.getToken(path))) {
        const placement = findExtensionPlacement(tokens, path, key, options, chosenFile);
        if (!("into" in placement)) return placement;
        const { into, currentExtension, alsoAffects } = placement;
        return {
            into,
            jsonPath: [...pathKeys, "$extensions", key],
            current: currentExtension,
            settingPath,
            alsoAffects,
        };
    }
    const placement = findPlacement(tokens, path, options, chosenFile);
    if (!("token" in placement)) return placement;
    const { into, token, alsoAffects } = placement;
    const own = getOwnProperties(token);
    return {
        into,
        jsonPath: pathKeys,
        current: own,
        settingPath: ["$extensions", key, ...settingPath],
        alsoAffects,
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
