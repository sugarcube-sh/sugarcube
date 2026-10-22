import type { DesignTokens, JsonPath, JsonValue, Permutations } from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import { opsAt } from "./file-text.js";
import type { FileOp, OpResult, PlaceOptions } from "./index.js";
import { asked, extensionPlace, ownProperties, placement } from "./placement.js";

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
 * const [place] = tokens.writtenAt("space.gutter");
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
    return setExtensionIn(tokens, path, jsonPath, value, options);
}

function setExtensionIn(
    tokens: DesignTokens,
    path: string,
    jsonPath: readonly [string, ...JsonPath],
    value: JsonValue | null,
    options: PlaceOptions,
    place?: string,
): OpResult {
    const placed = placeOf(tokens, path, jsonPath, options, place);
    if ("choose" in placed) {
        return asked(placed.choose, (file) =>
            setExtensionIn(tokens, path, jsonPath, value, options, file),
        );
    }
    if ("refused" in placed) return placed;
    const { alsoAffects } = placed;
    if ("at" in placed) {
        const { at, inForce } = placed;
        if (inForce === undefined) {
            return {
                ops: opsAt(tokens, at, ["$extensions", ...jsonPath], value),
                alsoAffects,
                moved: [],
            };
        }
        const [key, ...within] = jsonPath;
        const made = withSetting(inForce, within, value);
        const ops = made === inForce ? [] : opsAt(tokens, at, ["$extensions", key], made ?? null);
        return { ops, alsoAffects, moved: [] };
    }
    const { into, inside, was } = placed;
    const made = withSetting(was, placed.within, value);
    const ops: FileOp[] =
        made === was || made === undefined
            ? []
            : [{ kind: "add", file: into, jsonPath: inside, value: made }];
    return { ops, alsoAffects, moved: [] };
}

type Placed =
    | Exclude<ReturnType<typeof extensionPlace>, { into: string }>
    | {
          into: string;
          inside: JsonPath;
          was: JsonValue | undefined;
          within: JsonPath;
          alsoAffects: Permutations;
      };

function placeOf(
    tokens: DesignTokens,
    path: string,
    [key, ...within]: readonly [string, ...JsonPath],
    options: PlaceOptions,
    place: string | undefined,
): Placed {
    const steps = path.split(".");
    if (!tokens.permutations.some((perm) => perm.token(path))) {
        const placed = extensionPlace(tokens, path, key, options, place);
        if (!("into" in placed)) return placed;
        const { into, inForce, alsoAffects } = placed;
        return { into, inside: [...steps, "$extensions", key], was: inForce, within, alsoAffects };
    }
    const placed = placement(tokens, path, options, place);
    if (!("token" in placed)) return placed;
    const { into, token, alsoAffects } = placed;
    const own = ownProperties(token);
    return { into, inside: steps, was: own, within: ["$extensions", key, ...within], alsoAffects };
}

function withSetting(
    whole: JsonValue | undefined,
    jsonPath: JsonPath,
    value: JsonValue | null,
): JsonValue | undefined {
    const [step, ...rest] = jsonPath;
    if (step === undefined) return value ?? undefined;
    if (Array.isArray(whole) && typeof step === "number") {
        if (!Number.isInteger(step) || step < 0 || step >= whole.length) return whole;
        const changed = withSetting(whole[step], rest, value);
        if (changed === whole[step]) return whole;
        return changed === undefined
            ? whole.filter((_, index) => index !== step)
            : whole.map((each, index) => (index === step ? changed : each));
    }
    const key = String(step);
    const object = isJsonObject(whole) ? whole : undefined;
    const now = object?.[key];
    if (value === null && now === undefined) return whole;
    const changed = withSetting(now, rest, value);
    if (changed === now) return whole;
    if (changed !== undefined) return { ...object, [key]: changed };
    return Object.fromEntries(Object.entries(object ?? {}).filter(([each]) => each !== key));
}
