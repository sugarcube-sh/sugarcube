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
    WrittenReference,
} from "../model.js";
import { applyMovesToReference } from "../values/references.js";
import type { Occurrence } from "./occurrence.js";
import type { Target } from "./same-object.js";

export interface ReferenceWithTarget extends Target {
    occurrence: Occurrence;
}

class ReferenceObject {
    declare readonly pointsToProperty?: JsonPath | undefined;
    readonly pointsToPath: string | undefined;
    readonly writtenIn: Token | Group;
    readonly pointsToToken: Token | undefined;
    readonly pointsToWholeToken: Token | undefined;
    readonly writtenInProperty: JsonPath | undefined;
    readonly #written: WrittenReference;
    readonly #span: Span;
    readonly #isBarePointer: boolean;

    constructor(from: Token | Group, to: ReferenceWithTarget, isBarePointer: boolean) {
        const { occurrence, path, token, pointsToProperty } = to;
        const { reference, span, property } = occurrence;
        this.pointsToPath = path;
        this.writtenIn = from;
        this.pointsToToken = token;
        this.pointsToWholeToken = pointsToProperty === undefined ? token : undefined;
        this.writtenInProperty = property.length > 0 ? property : undefined;
        if (reference.syntax === "json-pointer") Object.assign(this, { pointsToProperty });
        this.#written = reference;
        this.#span = span;
        this.#isBarePointer = isBarePointer;
    }

    get asWritten(): WrittenReference {
        return this.#written;
    }

    static getSpan(reference: ReferenceObject): Span {
        return reference.#span;
    }

    moved(moves: readonly Move[]): JsonValue {
        return rewriteReference(this.#written, moves, this.#isBarePointer);
    }

    toReferenceInPermutations(
        writtenInPaths: readonly string[],
        permutations: Permutations,
        span: Span,
        jsonPath: () => JsonPath,
    ): ReferenceInPermutationsObject {
        return new ReferenceInPermutationsObject(
            this,
            this.#written,
            writtenInPaths,
            permutations,
            span,
            jsonPath,
            this.#isBarePointer,
        );
    }

    toJSON() {
        return { asWritten: this.#written, writtenInProperty: this.writtenInProperty };
    }
}

class ReferenceInPermutationsObject {
    readonly pointsToPath: string | undefined;
    readonly writtenInPaths: readonly string[];
    readonly pointsToProperty: JsonPath | undefined;
    readonly span: Span;
    readonly writtenInProperty: JsonPath | undefined;
    readonly permutations: Permutations;
    readonly #written: WrittenReference;
    readonly #jsonPath: () => JsonPath;
    readonly #isBarePointer: boolean;

    constructor(
        reference: ReferenceObject,
        written: WrittenReference,
        writtenInPaths: readonly string[],
        permutations: Permutations,
        span: Span,
        jsonPath: () => JsonPath,
        isBarePointer: boolean,
    ) {
        this.pointsToPath = reference.pointsToPath;
        this.writtenInPaths = writtenInPaths;
        this.pointsToProperty = reference.pointsToProperty;
        this.span = span;
        this.writtenInProperty = reference.writtenInProperty;
        this.permutations = permutations;
        this.#written = written;
        this.#jsonPath = jsonPath;
        this.#isBarePointer = isBarePointer;
    }

    get asWritten(): WrittenReference {
        return this.#written;
    }

    get jsonPath(): JsonPath {
        return this.#jsonPath();
    }

    moved(moves: readonly Move[]): JsonValue {
        return rewriteReference(this.#written, moves, this.#isBarePointer);
    }
}

export function createReference(
    from: Token | Group,
    to: ReferenceWithTarget,
    { pointerAlone = false } = {},
): Reference {
    return new ReferenceObject(from, to, pointerAlone) as unknown as Reference;
}

export function getReferenceSpan(reference: Reference): Span {
    return ReferenceObject.getSpan(reference as unknown as ReferenceObject);
}

export function toReferenceInPermutations(
    reference: Reference,
    writtenInPaths: readonly string[],
    permutations: Permutations,
    span: Span,
    jsonPath: () => JsonPath,
): ReferenceInPermutations {
    const inPermutations = (reference as unknown as ReferenceObject).toReferenceInPermutations(
        writtenInPaths,
        permutations,
        span,
        jsonPath,
    );
    return inPermutations as unknown as ReferenceInPermutations;
}

function rewriteReference(
    written: WrittenReference,
    moves: readonly Move[],
    isBarePointer: boolean,
): JsonValue {
    const now = applyMovesToReference(written, moves);
    if (now.syntax === "curly-brace") return `{${now.path}}`;
    return isBarePointer ? now.pointer : { $ref: now.pointer };
}
