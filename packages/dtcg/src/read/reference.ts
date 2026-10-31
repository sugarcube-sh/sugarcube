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
} from "../index.js";
import { movedReference } from "../values/references.js";
import type { Occurrence } from "./occurrence.js";
import type { Target } from "./same-object.js";

export interface ReferenceTo extends Target {
    occurrence: Occurrence;
}

class ReferenceObject {
    declare readonly pointer?: string;
    declare readonly targetProperty?: JsonPath | undefined;
    readonly path: string | undefined;
    readonly from: Token | Group;
    readonly token: Token | undefined;
    readonly property: JsonPath | undefined;
    readonly #written: WrittenReference;
    readonly #span: Span;
    readonly #pointerAlone: boolean;

    constructor(from: Token | Group, to: ReferenceTo, pointerAlone: boolean) {
        const { occurrence, path, token, targetProperty } = to;
        const { reference, span, property } = occurrence;
        this.path = path;
        this.from = from;
        this.token = token;
        this.property = property.length > 0 ? property : undefined;
        if (reference.syntax === "json-pointer") {
            Object.assign(this, { pointer: reference.pointer, targetProperty });
        }
        this.#written = reference;
        this.#span = span;
        this.#pointerAlone = pointerAlone;
    }

    get syntax(): WrittenReference["syntax"] {
        return this.#written.syntax;
    }

    static spanOf(reference: ReferenceObject): Span {
        return reference.#span;
    }

    moved(moves: readonly Move[]): JsonValue {
        return writtenAfter(this.#written, moves, this.#pointerAlone);
    }

    across(
        permutations: Permutations,
        span: Span,
        jsonPath: () => JsonPath,
    ): ReferenceAcrossPermutations {
        return new ReferenceAcrossPermutations(
            this,
            this.#written,
            permutations,
            span,
            jsonPath,
            this.#pointerAlone,
        );
    }

    toJSON() {
        const { syntax, path, property } = this;
        const written = this.#written;
        return written.syntax === "curly-brace"
            ? { syntax, path, property }
            : { syntax, pointer: written.pointer, property };
    }
}

class ReferenceAcrossPermutations {
    readonly syntax: WrittenReference["syntax"];
    readonly path: string | undefined;
    readonly pointer: string | undefined;
    readonly from: string;
    readonly targetProperty: JsonPath | undefined;
    readonly span: Span;
    readonly property: JsonPath | undefined;
    readonly permutations: Permutations;
    readonly #written: WrittenReference;
    readonly #jsonPath: () => JsonPath;
    readonly #pointerAlone: boolean;

    constructor(
        reference: ReferenceObject,
        written: WrittenReference,
        permutations: Permutations,
        span: Span,
        jsonPath: () => JsonPath,
        alone: boolean,
    ) {
        this.syntax = written.syntax;
        this.path = reference.path;
        this.pointer = written.syntax === "json-pointer" ? written.pointer : undefined;
        this.from = reference.from.path;
        this.targetProperty = reference.targetProperty;
        this.span = span;
        this.property = reference.property;
        this.permutations = permutations;
        this.#written = written;
        this.#jsonPath = jsonPath;
        this.#pointerAlone = alone;
    }

    get jsonPath(): JsonPath {
        return this.#jsonPath();
    }

    moved(moves: readonly Move[]): JsonValue {
        return writtenAfter(this.#written, moves, this.#pointerAlone);
    }
}

export function linkedReference(
    from: Token | Group,
    to: ReferenceTo,
    { pointerAlone = false } = {},
): Reference {
    return new ReferenceObject(from, to, pointerAlone) as unknown as Reference;
}

export function spanOfReference(reference: Reference): Span {
    return ReferenceObject.spanOf(reference as unknown as ReferenceObject);
}

export function acrossPermutations(
    reference: Reference,
    permutations: Permutations,
    span: Span,
    jsonPath: () => JsonPath,
): ReferenceInPermutations {
    const across = (reference as unknown as ReferenceObject).across(permutations, span, jsonPath);
    return across as unknown as ReferenceInPermutations;
}

function writtenAfter(
    written: WrittenReference,
    moves: readonly Move[],
    pointerAlone: boolean,
): JsonValue {
    const now = movedReference(written, moves);
    if (now.syntax === "curly-brace") return `{${now.path}}`;
    return pointerAlone ? now.pointer : { $ref: now.pointer };
}
