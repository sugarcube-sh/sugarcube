import type {
    DiagnosticDetailByKind,
    DiagnosticKind,
    Input,
    JsonPath,
    Span,
    TokenType,
    WrittenReference,
} from "../model.js";
import { isJsonObject } from "../values/json.js";
import { toReferenceTarget } from "../values/references.js";
import type { DeferredRead } from "../values/read-syntax.js";
import type { Siblings } from "../values/syntax.js";
import type { MergedToken, Merged } from "./merge.js";
import { type Occurrence, occurrence } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./parse-value.js";
import { type ReferenceLookup, followReference, getAtPath, toPointerSteps } from "./ref-meaning.js";

export const UNRESOLVED = Symbol("unresolved");

export type Target = "untyped" | { type: TokenType; resolved?: unknown };

export interface ReferenceResolver {
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
    reportUnresolved(aim: ReferenceLookup, from: string, span: Span): void;
    reportUnreachable(aim: ReferenceLookup, from: string, span: Span): void;
}

interface ResolveState {
    token: MergedToken;
    seen: string[];
    origin: Occurrence | undefined;
}

export function resolveValue(
    resolver: ReferenceResolver,
    token: MergedToken,
    value: unknown,
    references: LocatedReference[],
    deferredReads: DeferredRead[],
): unknown {
    const following = { token, seen: [], origin: undefined };
    return resolveReferences(resolver, following, value, references, deferredReads);
}

function resolveReferences(
    resolver: ReferenceResolver,
    following: ResolveState,
    value: unknown,
    references: LocatedReference[],
    deferredReads: DeferredRead[],
): unknown {
    const followed: [LocatedReference, unknown][] = [];
    let resolved = value;
    let failed = false;
    for (const located of references) {
        const { property } = located.reference;
        if (deferredReads.some((each) => startsWith(property, each.property))) continue;
        const part = resolveReferenceValue(resolver, following, located);
        if (part === UNRESOLVED) failed = true;
        else {
            followed.push([located, part]);
            resolved = setAtPath(resolved, property, part);
        }
    }
    if (failed) return UNRESOLVED;

    const { readValue, input } = resolver;
    const { token, origin } = following;
    for (const again of deferredReads) {
        const { jsonPath, tokenType, raw } = again;
        const syntax = again.from(resolveSiblings(again, followed));
        const slot = { syntax, jsonPath, tokenType, isElement: false };
        const { result, notes } = readValue.readSlot(token, slot, raw, input);
        if (!result.ok) return UNRESOLVED;
        const inner = notes.references.map((reference) => ({
            reference,
            occurrence: origin ?? occurrence(token, reference),
        }));
        const part = resolveReferences(
            resolver,
            following,
            result.value,
            inner,
            notes.deferredReads,
        );
        if (part === UNRESOLVED) return UNRESOLVED;
        resolved = setAtPath(resolved, again.property, part);
    }
    return resolved;
}

function resolveReferenceValue(
    resolver: ReferenceResolver,
    following: ResolveState,
    located: LocatedReference,
): unknown {
    const { merged, readValue, input } = resolver;
    const { token, seen, origin } = following;
    const { ref, syntax, tokenType, isElement, jsonPath } = located.reference;
    const use = origin ?? located.occurrence;
    const expected = syntax.kind === "ofType" ? syntax.type : tokenType;
    const adjusted = (part: unknown) =>
        part !== UNRESOLVED && syntax.kind === "ofType" && syntax.adjust
            ? syntax.adjust(part)
            : part;

    if (ref.syntax === "curly-brace") {
        return adjusted(substitute(resolver, token, ref, ref.path, expected, use, isElement));
    }

    const { pointer: written } = ref;
    if (seen.includes(written)) {
        resolver.report("circular-reference", { chain: [...seen, written] }, token.path, use.span);
        return UNRESOLVED;
    }
    const aim = { reference: ref, steps: toPointerSteps(ref) };
    const reached = followReference(aim, merged);
    const unreachable = () => {
        if (origin) resolver.reportUnresolved(aim, token.path, use.span);
        else resolver.reportUnreachable(aim, token.path, use.span);
        return UNRESOLVED;
    };
    if (reached.kind !== "token" && reached.kind !== "part") return unreachable();

    const whole = reached.kind === "token";
    if (whole && (syntax.kind === "ofType" || isElement)) {
        return adjusted(substitute(resolver, token, ref, reached.path, expected, use, isElement));
    }
    const { valueAsWritten } = reached.token;
    const stepped = whole ? { value: valueAsWritten } : getAtPath(valueAsWritten, reached.inside);
    if (!stepped) return unreachable();
    const raw = stepped.value;

    const slot = { syntax, jsonPath, tokenType, isElement };
    const { result, notes } = readValue.readSlot(token, slot, raw, input);
    if (!result.ok) return UNRESOLVED;
    const inner = notes.references.map((reference) => ({ reference, occurrence: use }));
    const deeper = { token, seen: [...seen, written], origin: use };
    return resolveReferences(resolver, deeper, result.value, inner, notes.deferredReads);
}

function substitute(
    resolver: ReferenceResolver,
    token: MergedToken,
    reference: WrittenReference,
    path: string,
    expected: TokenType,
    use: Occurrence,
    isElement: boolean,
): unknown {
    const { span } = use;
    const shown = toReferenceTarget(reference);
    const target = resolver.resolveDependency(path, token.path, span);
    if (target === undefined) {
        resolver.reportUnresolved(
            { reference, steps: toPointerSteps(reference) },
            token.path,
            span,
        );
        return UNRESOLVED;
    }
    if (target === "untyped" || !("resolved" in target)) return UNRESOLVED;
    if (target.type !== expected) {
        resolver.report(
            "type-mismatch",
            { ref: shown, expected, found: target.type },
            token.path,
            span,
        );
        return UNRESOLVED;
    }
    if (!isElement) return target.resolved;
    const list = Array.isArray(target.resolved) ? target.resolved : [target.resolved];
    if (list.length !== 1) {
        resolver.report(
            "reference-to-several",
            { ref: shown, count: list.length },
            token.path,
            span,
        );
        return UNRESOLVED;
    }
    return list[0];
}

function resolveSiblings(again: DeferredRead, followed: [LocatedReference, unknown][]): Siblings {
    const parent = again.property.slice(0, -1);
    const siblings: Record<string, unknown> = { ...again.siblings };
    for (const [{ reference }, part] of followed) {
        const { property } = reference;
        const name = property.at(-1);
        const beside = property.length === again.property.length && startsWith(property, parent);
        if (beside && typeof name === "string") siblings[name] = part;
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
