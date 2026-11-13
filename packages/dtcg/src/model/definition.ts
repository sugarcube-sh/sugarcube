import type { JsonValue } from "./json.js";
import type { JsonPath, Span } from "./location.js";
import type { Permutations } from "./permutations.js";
import type { Source } from "./source.js";

/**
 * A place where a token or group is written.
 *
 * A definition read by several permutations is the same object in each. To find where it is in
 * the file, use `getSpan`.
 *
 * @example
 * // Where dark gets color.primary
 * dark.getToken("color.primary")!.winningDefinition.json
 * // => { $type: "color", $value: "{color.blue.300}" }
 */
export interface Definition {
    /**
     * The source that writes it.
     *
     * That's the file, or part of one, and the set or context it's read through.
     */
    readonly source: Source;
    /**
     * The JSON written there, exactly as written.
     *
     * For a token, that's its whole object, such as `{ "$value": "{color.blue.500}" }`.
     */
    readonly json: JsonValue;
}

/**
 * A definition as {@link DesignTokens.getDefinitions} returns it.
 *
 * It's written once, and can be read in several permutations.
 */
export interface DefinitionInPermutations {
    /** Where it's written in its file. */
    readonly span: Span;
    /** The keys to where it's written, as `getJsonPath` gives them. */
    readonly jsonPath: JsonPath;
    /** The JSON written there, exactly as written. */
    readonly json: JsonValue;
    /** The sources that read it. */
    readonly sources: readonly Source[];
    /** The permutations that read it. */
    readonly permutations: Permutations;
    /**
     * The permutations where this definition gives the token its value.
     *
     * It's empty when a later file always replaces it, and for a group, whose definitions are
     * combined.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#ordering | Resolver 6.2, Ordering}
     *
     * @example
     * // color.json's definition wins in light, dark.json's in dark
     * tokens.getDefinitions("color.primary").map((d) => d.winningPermutations.label)
     * // => ["mode: light", "mode: dark"]
     */
    readonly winningPermutations: Permutations;
}
