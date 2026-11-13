import type {
    DiagnosticDetailByKind,
    DiagnosticKind,
    Input,
    JsonPath,
    JsonPointerReference,
    Span,
    TokenType,
} from "../../model/index.js";
import { isJsonObject } from "../../values/json.js";
import { toReferenceTarget } from "../../values/references.js";
import type { DeferredRead, Slot } from "../../values/read-syntax.js";
import type { Siblings } from "../../values/syntax.js";
import type { MergedToken, Merged } from "../merge/merge.js";
import { type Occurrence, occurrence } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./value-reader.js";
import {
    type ReferenceLookup,
    followReference,
    getAtPath,
    toPointerSteps,
} from "../merge/target.js";

export const UNRESOLVED = Symbol("unresolved");

export type Target = "untyped" | { type: TokenType; resolved?: unknown };

export interface ResolveContext {
    readonly readValue: ValueReader;
    readonly merged: Merged;
    readonly input: Input;
    resolveDependency(path: string, from: string, span: Span): Target | undefined;
    report<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        path: string,
        span: Span,
    ): void;
    reportUnresolved(lookup: ReferenceLookup, from: string, span: Span): void;
    reportUnreachable(lookup: ReferenceLookup, from: string, span: Span): void;
}

interface ResolvedReference {
    located: LocatedReference;
    value: unknown;
}

export function resolveValue(
    context: ResolveContext,
    token: MergedToken,
    value: unknown,
    references: LocatedReference[],
    deferredReads: DeferredRead[],
): unknown {
    const resolution = new ValueResolution(context, token, [], undefined);
    return resolution.resolve(value, references, deferredReads);
}

class ValueResolution {
    readonly #context: ResolveContext;
    readonly #token: MergedToken;
    readonly #seen: readonly string[];
    readonly #origin: Occurrence | undefined;

    constructor(
        context: ResolveContext,
        token: MergedToken,
        seen: readonly string[],
        origin: Occurrence | undefined,
    ) {
        this.#context = context;
        this.#token = token;
        this.#seen = seen;
        this.#origin = origin;
    }

    resolve(
        value: unknown,
        references: LocatedReference[],
        deferredReads: DeferredRead[],
    ): unknown {
        const resolvedReferences = this.#resolveEach(references, deferredReads);
        if (resolvedReferences === UNRESOLVED) return UNRESOLVED;

        let resolved = value;
        for (const each of resolvedReferences) {
            resolved = setAtPath(resolved, each.located.reference.property, each.value);
        }
        return this.#resolveDeferredReads(resolved, deferredReads, resolvedReferences);
    }

    #resolveEach(
        references: LocatedReference[],
        deferredReads: DeferredRead[],
    ): ResolvedReference[] | typeof UNRESOLVED {
        const resolvedReferences: ResolvedReference[] = [];
        let failed = false;
        for (const located of references) {
            if (waitsOnSiblings(located.reference.property, deferredReads)) continue;
            const value = this.#resolveReference(located);
            if (value === UNRESOLVED) failed = true;
            else resolvedReferences.push({ located, value });
        }
        return failed ? UNRESOLVED : resolvedReferences;
    }

    #resolveDeferredReads(
        value: unknown,
        deferredReads: DeferredRead[],
        resolvedReferences: ResolvedReference[],
    ): unknown {
        let resolved = value;
        for (const deferred of deferredReads) {
            const part = this.#resolveDeferredRead(deferred, resolvedReferences);
            if (part === UNRESOLVED) return UNRESOLVED;
            resolved = setAtPath(resolved, deferred.property, part);
        }
        return resolved;
    }

    #resolveDeferredRead(deferred: DeferredRead, resolvedReferences: ResolvedReference[]): unknown {
        const { jsonPath, tokenType, raw } = deferred;
        const syntax = deferred.from(resolveSiblings(deferred, resolvedReferences));
        const slot = { syntax, jsonPath, tokenType, isElement: false };
        const { result, notes } = this.#readSlot(slot, raw);
        if (!result.ok) return UNRESOLVED;

        const references = notes.references.map((reference) => ({
            reference,
            occurrence: this.#origin ?? occurrence(this.#token, reference),
        }));
        return this.resolve(result.value, references, notes.deferredReads);
    }

    #resolveReference(located: LocatedReference): unknown {
        const { ref } = located.reference;
        if (ref.syntax === "curly-brace") return this.#substitute(located, ref.path);
        return this.#resolvePointer(located, ref);
    }

    #resolvePointer(located: LocatedReference, ref: JsonPointerReference): unknown {
        const { syntax, isElement } = located.reference;
        const use = this.#useOf(located);
        if (this.#seen.includes(ref.pointer)) {
            const chain = [...this.#seen, ref.pointer];
            this.#context.report("circular-reference", { chain }, this.#token.path, use.span);
            return UNRESOLVED;
        }

        const lookup = { reference: ref, steps: toPointerSteps(ref) };
        const target = followReference(lookup, this.#context.merged);
        if (target.kind !== "token" && target.kind !== "part") {
            return this.#reportNoTarget(lookup, use);
        }

        const whole = target.kind === "token";
        if (whole && (syntax.kind === "ofType" || isElement)) {
            return this.#substitute(located, target.path);
        }

        const { originalValue } = target.token;
        const pointed = whole ? { value: originalValue } : getAtPath(originalValue, target.inside);
        if (!pointed) return this.#reportNoTarget(lookup, use);
        return this.#readPointedValue(located, ref.pointer, pointed.value);
    }

    #readPointedValue(located: LocatedReference, pointer: string, raw: unknown): unknown {
        const { syntax, jsonPath, tokenType, isElement } = located.reference;
        const slot = { syntax, jsonPath, tokenType, isElement };
        const { result, notes } = this.#readSlot(slot, raw);
        if (!result.ok) return UNRESOLVED;

        const use = this.#useOf(located);
        const references = notes.references.map((reference) => ({ reference, occurrence: use }));
        const seen = [...this.#seen, pointer];
        const deeper = new ValueResolution(this.#context, this.#token, seen, use);
        return deeper.resolve(result.value, references, notes.deferredReads);
    }

    #substitute(located: LocatedReference, path: string): unknown {
        const { syntax } = located.reference;
        const part = this.#takeTargetValue(located, path);
        if (part === UNRESOLVED || syntax.kind !== "ofType" || !syntax.adjust) return part;
        return syntax.adjust(part);
    }

    #takeTargetValue(located: LocatedReference, path: string): unknown {
        const { ref, syntax, tokenType, isElement } = located.reference;
        const expected = syntax.kind === "ofType" ? syntax.type : tokenType;
        const { span } = this.#useOf(located);
        const from = this.#token.path;
        const shown = toReferenceTarget(ref);

        const target = this.#context.resolveDependency(path, from, span);
        if (target === undefined) {
            this.#context.reportUnresolved(
                { reference: ref, steps: toPointerSteps(ref) },
                from,
                span,
            );
            return UNRESOLVED;
        }
        if (target === "untyped" || !("resolved" in target)) return UNRESOLVED;
        if (target.type !== expected) {
            const detail = { ref: shown, expected, found: target.type };
            this.#context.report("type-mismatch", detail, from, span);
            return UNRESOLVED;
        }
        if (!isElement) return target.resolved;

        const list = Array.isArray(target.resolved) ? target.resolved : [target.resolved];
        if (list.length !== 1) {
            this.#context.report(
                "reference-to-several",
                { ref: shown, count: list.length },
                from,
                span,
            );
            return UNRESOLVED;
        }
        return list[0];
    }

    #reportNoTarget(lookup: ReferenceLookup, use: Occurrence): typeof UNRESOLVED {
        const from = this.#token.path;
        if (this.#origin) this.#context.reportUnresolved(lookup, from, use.span);
        else this.#context.reportUnreachable(lookup, from, use.span);
        return UNRESOLVED;
    }

    #readSlot(slot: Slot, raw: unknown) {
        return this.#context.readValue.readSlot(this.#token, slot, raw, this.#context.input);
    }

    #useOf(located: LocatedReference): Occurrence {
        return this.#origin ?? located.occurrence;
    }
}

function waitsOnSiblings(property: JsonPath, deferredReads: DeferredRead[]): boolean {
    return deferredReads.some((deferred) => startsWith(property, deferred.property));
}

function resolveSiblings(
    deferred: DeferredRead,
    resolvedReferences: ResolvedReference[],
): Siblings {
    const parent = deferred.property.slice(0, -1);
    const siblings: Record<string, unknown> = { ...deferred.siblings };
    for (const { located, value } of resolvedReferences) {
        const { property } = located.reference;
        const name = property.at(-1);
        const beside = property.length === deferred.property.length && startsWith(property, parent);
        if (beside && typeof name === "string") siblings[name] = value;
    }
    return siblings;
}

function setAtPath(value: unknown, property: JsonPath, part: unknown): unknown {
    const [step, ...rest] = property;
    if (step === undefined) return part;
    if (Array.isArray(value)) {
        return value.map((item, index) => (index === step ? setAtPath(item, rest, part) : item));
    }
    if (isJsonObject(value) && typeof step === "string") {
        return { ...value, [step]: setAtPath(value[step], rest, part) };
    }
    return value;
}

function startsWith(jsonPath: JsonPath, start: JsonPath): boolean {
    return start.length <= jsonPath.length && start.every((step, i) => jsonPath[i] === step);
}
