import type {
    Group,
    JsonPath,
    JsonValue,
    Move,
    Permutations,
    Reference,
    ReferenceInPermutations,
    Span,
    Token,
    ParsedReference,
} from "../model.js";
import { applyMovesToReference } from "../values/references.js";
import type { Occurrence } from "./build/occurrence.js";
import type { Target } from "./same-object.js";

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
