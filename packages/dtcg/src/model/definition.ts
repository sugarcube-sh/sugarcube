import type { JsonValue } from "./json.js";
import type { JsonPath, Span } from "./location.js";
import type { Permutations } from "./permutations.js";
import { type Source, SourceObject } from "./source.js";
import { parse } from "jsonc-parser";

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

export const NO_DEFINITIONS: readonly Definition[] = Object.freeze([]);

export const NO_EXTENSION_DEFINITIONS: Readonly<Record<string, Definition>> = Object.freeze({});

export class DefinitionObject {
    readonly source: Source;
    readonly #span: Span;
    #asList: Definition[] | undefined;
    #text: string | undefined;
    #textAt: Span;
    #json: JsonValue | undefined;

    constructor(source: Source, span: Span, text: string | undefined) {
        this.source = source;
        this.#span = span;
        this.#text = text;
        this.#textAt = span;
    }

    get json(): JsonValue {
        if (this.#json === undefined) {
            this.#json = parse(sliceSpan(this.#text, this.#textAt) ?? "null");
            this.#text = undefined;
        }
        return this.#json as JsonValue;
    }

    static getSpan(definition: DefinitionObject): Span {
        return definition.#span;
    }

    static setText(definition: DefinitionObject, text: string | undefined, span: Span): void {
        if (definition.#json !== undefined) return;
        definition.#text = text;
        definition.#textAt = span;
    }

    static asList(definition: DefinitionObject): Definition[] {
        definition.#asList ??= [definition];
        return definition.#asList;
    }

    toJSON() {
        return { source: SourceObject.positionOf(this.source) };
    }
}

export function sliceSpan(text: string | undefined, { offset, length }: Span): string | undefined {
    return text?.slice(offset, offset + length);
}
