import type { JsonValue } from "./json.js";
import type { JsonPath, Span } from "./location.js";
import type { Permutations } from "./permutations.js";
import { type Source, SourceObject } from "./source.js";
import type { TokenType } from "./value.js";
import { parse } from "jsonc-parser";
import { readLocal } from "../lookup/local.js";

/**
 * The properties a token or group writes itself, not those it gets from a group it's inside or a
 * group it extends.
 */
export interface LocalProperties {
    /** Its `$type`, when that's a type the spec defines. */
    readonly type?: TokenType;
    /** Its `$description`. */
    readonly description?: string;
    /** Its `$deprecated`, `false` included. */
    readonly deprecated?: boolean | string;
    /** Its `$extensions`. */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}

/**
 * The properties a file writes for a token itself, such as its `value`.
 *
 * @example
 * // color.primary in dark.json
 * dark.getToken("color.primary")!.winningDefinition.local
 * // => { value: "{color.blue.300}", type: "color" }
 */
export interface LocalToken extends LocalProperties {
    /** Its `$value`, exactly as written, such as `"{color.blue.500}"`. */
    readonly value?: JsonValue;
}

/**
 * The properties a file writes for a group itself, such as its `extends`.
 *
 * @example
 * // cta writes "$extends": "{button}" and nothing else
 * light.getGroup("cta")!.local
 * // => { extends: "button" }
 */
export interface LocalGroup extends LocalProperties {
    /** The path its `$extends` names, such as `"button"`. */
    readonly extends?: string;
}

/**
 * A token or group as one file writes it.
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
    /**
     * The properties written here, not inherited: `value` for a token, `extends` for a group.
     *
     * A token's written properties are its {@link TokenBase.winningDefinition | winningDefinition}'s,
     * since a later file replaces a token whole.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#ordering | Resolver 6.2, Ordering}
     *
     * @example
     * // color.primary in dark.json
     * dark.getToken("color.primary")!.winningDefinition.local
     * // => { value: "{color.blue.300}", type: "color" }
     */
    readonly local: LocalToken & LocalGroup;
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
    /** The properties written here, not inherited, as {@link Definition.local}. */
    readonly local: LocalToken & LocalGroup;
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
    #local: (LocalToken & LocalGroup) | undefined;

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

    get local(): LocalToken & LocalGroup {
        this.#local ??= readLocal(this.json);
        return this.#local;
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
