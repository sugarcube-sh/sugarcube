import type { Move } from "./change.js";
import type { Group } from "./group.js";
import type { JsonValue } from "./json.js";
import type { JsonPath, Span } from "./location.js";
import type { Permutations } from "./permutations.js";
import type { Token } from "./token.js";
import type { Occurrence } from "../read/build/occurrence.js";
import { applyMovesToReference } from "../values/references.js";

/**
 * A curly brace reference, such as `"{color.primary}"`.
 *
 * It stands for the whole value of the token at `path`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#curly-brace-syntax-token-references | Format 7.1.1, Curly brace syntax}
 *
 * @example
 * // button.background's value
 * light.getToken("button.background")!.value
 * // => { syntax: "curly-brace", path: "color.primary" }
 */
export interface CurlyBraceReference {
    readonly syntax: "curly-brace";
    /** The path of the token it refers to, such as `"color.primary"`. */
    readonly path: string;
}

/**
 * A JSON Pointer reference, such as `{ "$ref": "#/color/blue/500/$value" }`.
 *
 * It can point at a whole token, or inside a value, such as at one color component.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax} and
 * {@link https://www.designtokens.org/TR/2025.10/format/#property-level-references | 7.3, Property-level references}
 *
 * @example
 * // The first component of color.blue.500
 * parseReference({ $ref: "#/color/blue/500/$value/components/0" })
 * // => { syntax: "json-pointer", pointer: "#/color/blue/500/$value/components/0" }
 */
export interface JsonPointerReference {
    readonly syntax: "json-pointer";
    /** The pointer as written, such as `"#/color/blue/500/$value"`. */
    readonly pointer: string;
}

/**
 * A reference in either syntax, as written.
 *
 * {@link isReference} tells one from a value.
 */
export type ParsedReference = CurlyBraceReference | JsonPointerReference;

/**
 * A reference written in a token or group.
 *
 * A token lists its references in {@link TokenBase.references | references}, and so does a
 * {@link Group.references | group}.
 *
 * @example
 * // button.background's reference
 * light.getToken("button.background")!.references[0]!.pointsToPath
 * // => "color.primary"
 */
export type Reference = ReferenceBase;

/** What every {@link Reference} has. */
export interface ReferenceBase {
    /** The reference as written, such as `{ syntax: "curly-brace", path: "color.primary" }`. */
    readonly parsed: ParsedReference;
    /**
     * The path the reference names, such as `"color.primary"`.
     *
     * For a group's `$extends`, it's the group's path. For a JSON Pointer inside a value, it's the
     * path of that value's token. It's absent for a pointer that names no path, such as `#/`.
     */
    readonly pointsToPath?: string;
    /**
     * The token or group that has the reference.
     *
     * For a token from `$extends`, it's the token in the group that extends.
     */
    readonly owner: Token | Group;
    /**
     * The token the reference points to, in this permutation.
     *
     * For a JSON Pointer into part of a value, it's the token that value is in. It's `undefined`
     * for a group, or for nothing. For the whole token only, use
     * {@link ReferenceBase.pointsToWholeToken | pointsToWholeToken}.
     */
    readonly pointsToToken?: Token;
    /**
     * The token the reference points to as a whole.
     *
     * It's `undefined` for a JSON Pointer into part of a token's value.
     */
    readonly pointsToWholeToken?: Token;
    /**
     * Where in the token's value a JSON Pointer points.
     *
     * For example, `["components", 0]`. It's absent when the reference points to the whole value.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#property-level-references | Format 7.3, Property-level references}
     */
    readonly pointsToProperty?: JsonPath;
    /**
     * Where in {@link TokenBase.value | value} the reference is.
     *
     * For example, `["components", 0]`, or `[0, "color"]` in a single shadow, which is read as an
     * array of one. It's absent for a reference that is the whole value.
     */
    readonly property?: JsonPath;
    /**
     * Rewrites the reference after some moves, such as a rename.
     *
     * It keeps the syntax it was written in. Paths move as {@link tokenPath.applyMoves} moves them.
     *
     * @param moves - The {@link Move}s, made in order, such as
     * `[{ from: "color.primary", to: "color.accent" }]`.
     *
     * @example
     * // After renaming color.primary
     * reference.applyMoves([{ from: "color.primary", to: "color.accent" }])
     * // => "{color.accent}"
     */
    applyMoves(moves: readonly Move[]): JsonValue;
}

/**
 * A reference as {@link DesignTokens.getReferencesTo} returns it.
 *
 * It's written once, and can apply in several permutations.
 */
export type ReferenceInPermutations = Omit<
    ReferenceBase,
    "owner" | "pointsToToken" | "applyMoves"
> & {
    /** Where the reference is written in its file. */
    readonly span: Span;
    /** The keys to where it's written, as `getJsonPath` gives them. */
    readonly jsonPath: JsonPath;
    /**
     * The paths of the tokens or groups that have it.
     *
     * The first is the one written in the file. The rest get it through `$extends`.
     */
    readonly ownerPaths: readonly string[];
    /** The permutations the reference applies in. */
    readonly permutations: Permutations;
    /** Rewrites the reference after some moves, as {@link ReferenceBase.applyMoves} does. */
    applyMoves(moves: readonly Move[]): JsonValue;
};

/** One group from {@link groupPermutationsBy}. */
export interface PermutationGroup<Result> {
    /** What the function returned, such as `"rgb(51 102 204)"`. */
    readonly result: Result;
    /** The permutations where the function returned `result`. */
    readonly permutations: Permutations;
}

/** How far questions about references look. */
export interface ReferenceOptions {
    /**
     * Follows references through other tokens too, however far.
     *
     * Each reference is listed once, even if references loop.
     *
     * @default false
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#chained-references | Format 7.2.2, Chained references}
     */
    chained?: boolean;
}

export const NO_REFERENCES: readonly Reference[] = Object.freeze([]);

export interface Target {
    path?: string | undefined;
    token?: Token | undefined;
    pointsToProperty?: JsonPath | undefined;
}

export interface ReferenceWithTarget extends Target {
    occurrence: Occurrence;
}

class ReferenceObject {
    declare readonly pointsToProperty?: JsonPath | undefined;
    readonly pointsToPath: string | undefined;
    readonly owner: Token | Group;
    readonly pointsToToken: Token | undefined;
    readonly pointsToWholeToken: Token | undefined;
    readonly property: JsonPath | undefined;
    readonly #parsed: ParsedReference;
    readonly #span: Span;
    readonly #isBarePointer: boolean;

    constructor(from: Token | Group, to: ReferenceWithTarget, isBarePointer: boolean) {
        const { occurrence, path, token, pointsToProperty } = to;
        const { reference, span, property } = occurrence;
        this.pointsToPath = path;
        this.owner = from;
        this.pointsToToken = token;
        this.pointsToWholeToken = pointsToProperty === undefined ? token : undefined;
        this.property = property.length > 0 ? property : undefined;
        if (reference.syntax === "json-pointer") Object.assign(this, { pointsToProperty });
        this.#parsed = reference;
        this.#span = span;
        this.#isBarePointer = isBarePointer;
    }

    get parsed(): ParsedReference {
        return this.#parsed;
    }

    static getSpan(reference: ReferenceObject): Span {
        return reference.#span;
    }

    applyMoves(moves: readonly Move[]): JsonValue {
        return rewriteReference(this.#parsed, moves, this.#isBarePointer);
    }

    toReferenceInPermutations(
        ownerPaths: readonly string[],
        permutations: Permutations,
        span: Span,
        jsonPath: () => JsonPath,
    ): ReferenceInPermutationsObject {
        return new ReferenceInPermutationsObject(
            this,
            this.#parsed,
            ownerPaths,
            permutations,
            span,
            jsonPath,
            this.#isBarePointer,
        );
    }

    toJSON() {
        return { parsed: this.#parsed, property: this.property };
    }
}

class ReferenceInPermutationsObject {
    readonly pointsToPath: string | undefined;
    readonly ownerPaths: readonly string[];
    readonly pointsToProperty: JsonPath | undefined;
    readonly span: Span;
    readonly property: JsonPath | undefined;
    readonly permutations: Permutations;
    readonly #parsed: ParsedReference;
    readonly #jsonPath: () => JsonPath;
    readonly #isBarePointer: boolean;

    constructor(
        reference: ReferenceObject,
        parsed: ParsedReference,
        ownerPaths: readonly string[],
        permutations: Permutations,
        span: Span,
        jsonPath: () => JsonPath,
        isBarePointer: boolean,
    ) {
        this.pointsToPath = reference.pointsToPath;
        this.ownerPaths = ownerPaths;
        this.pointsToProperty = reference.pointsToProperty;
        this.span = span;
        this.property = reference.property;
        this.permutations = permutations;
        this.#parsed = parsed;
        this.#jsonPath = jsonPath;
        this.#isBarePointer = isBarePointer;
    }

    get parsed(): ParsedReference {
        return this.#parsed;
    }

    get jsonPath(): JsonPath {
        return this.#jsonPath();
    }

    applyMoves(moves: readonly Move[]): JsonValue {
        return rewriteReference(this.#parsed, moves, this.#isBarePointer);
    }
}

export function createReference(
    from: Token | Group,
    to: ReferenceWithTarget,
    { isBarePointer = false } = {},
): Reference {
    return new ReferenceObject(from, to, isBarePointer) as unknown as Reference;
}

export function getReferenceSpan(reference: Reference): Span {
    return ReferenceObject.getSpan(reference as unknown as ReferenceObject);
}

export function toReferenceInPermutations(
    reference: Reference,
    ownerPaths: readonly string[],
    permutations: Permutations,
    span: Span,
    jsonPath: () => JsonPath,
): ReferenceInPermutations {
    const inPermutations = (reference as unknown as ReferenceObject).toReferenceInPermutations(
        ownerPaths,
        permutations,
        span,
        jsonPath,
    );
    return inPermutations as unknown as ReferenceInPermutations;
}

function rewriteReference(
    parsed: ParsedReference,
    moves: readonly Move[],
    isBarePointer: boolean,
): JsonValue {
    const now = applyMovesToReference(parsed, moves);
    if (now.syntax === "curly-brace") return `{${now.path}}`;
    return isBarePointer ? now.pointer : { $ref: now.pointer };
}
