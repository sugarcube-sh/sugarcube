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
import type { ReadAgain } from "../values/read-syntax.js";
import type { Siblings } from "../values/syntax.js";
import type { MergedToken, Merged } from "./merge.js";
import { type Occurrence, occurrence } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./parse-value.js";
import { type Aim, followReference, stepInto, toPointerSteps } from "./ref-meaning.js";

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
    reportUnresolved(aim: Aim, from: string, span: Span): void;
    reportUnreachable(aim: Aim, from: string, span: Span): void;
}

interface Following {
    token: MergedToken;
    seen: string[];
    within: Occurrence | undefined;
}

export function resolveValue(
    resolver: ReferenceResolver,
    token: MergedToken,
    value: unknown,
    references: LocatedReference[],
    readAgain: ReadAgain[],
): unknown {
    const following = { token, seen: [], within: undefined };
    return resolveReferences(resolver, following, value, references, readAgain);
}

function resolveReferences(
    resolver: ReferenceResolver,
    following: Following,
    value: unknown,
    references: LocatedReference[],
    readAgain: ReadAgain[],
): unknown {
    const followed: [LocatedReference, unknown][] = [];
    let resolved = value;
    let failed = false;
    for (const located of references) {
        const { property } = located.reference;
        if (readAgain.some((each) => startsWith(property, each.property))) continue;
        const part = follow(resolver, following, located);
        if (part === UNRESOLVED) failed = true;
        else {
            followed.push([located, part]);
            resolved = replaced(resolved, property, part);
        }
    }
    if (failed) return UNRESOLVED;

    const { readValue, input } = resolver;
    const { token, within } = following;
    for (const again of readAgain) {
        const { jsonPath, owner, raw } = again;
        const syntax = again.from(resolveSiblings(again, followed));
        const slot = { syntax, jsonPath, owner, element: false };
        const { result, notes } = readValue.readTarget(token, slot, raw, input);
        if (!result.ok) return UNRESOLVED;
        const inner = notes.references.map((reference) => ({
            reference,
            occurrence: within ?? occurrence(token, reference),
        }));
        const part = resolveReferences(resolver, following, result.value, inner, notes.readAgain);
        if (part === UNRESOLVED) return UNRESOLVED;
        resolved = replaced(resolved, again.property, part);
    }
    return resolved;
}

function follow(
    resolver: ReferenceResolver,
    following: Following,
    located: LocatedReference,
): unknown {
    const { merged, readValue, input } = resolver;
    const { token, seen, within } = following;
    const { ref, syntax, owner, element, jsonPath } = located.reference;
    const use = within ?? located.occurrence;
    const expected = syntax.kind === "ofType" ? syntax.type : owner;
    const adjusted = (part: unknown) =>
        part !== UNRESOLVED && syntax.kind === "ofType" && syntax.adjust
            ? syntax.adjust(part)
            : part;

    if (ref.syntax === "curly-brace") {
        return adjusted(substitute(resolver, token, ref, ref.path, expected, use, element));
    }

    const { pointer: written } = ref;
    if (seen.includes(written)) {
        resolver.report("circular-reference", { chain: [...seen, written] }, token.path, use.span);
        return UNRESOLVED;
    }
    const aim = { reference: ref, steps: toPointerSteps(ref) };
    const reached = followReference(aim, merged);
    const unreachable = () => {
        if (within) resolver.reportUnresolved(aim, token.path, use.span);
        else resolver.reportUnreachable(aim, token.path, use.span);
        return UNRESOLVED;
    };
    if (reached.kind !== "token" && reached.kind !== "part") return unreachable();

    const whole = reached.kind === "token";
    if (whole && (syntax.kind === "ofType" || element)) {
        return adjusted(substitute(resolver, token, ref, reached.path, expected, use, element));
    }
    const { valueAsWritten } = reached.token;
    const stepped = whole ? { value: valueAsWritten } : stepInto(valueAsWritten, reached.inside);
    if (!stepped) return unreachable();
    const raw = stepped.value;

    const slot = { syntax, jsonPath, owner, element };
    const { result, notes } = readValue.readTarget(token, slot, raw, input);
    if (!result.ok) return UNRESOLVED;
    const inner = notes.references.map((reference) => ({ reference, occurrence: use }));
    const deeper = { token, seen: [...seen, written], within: use };
    return resolveReferences(resolver, deeper, result.value, inner, notes.readAgain);
}

function substitute(
    resolver: ReferenceResolver,
    token: MergedToken,
    reference: WrittenReference,
    path: string,
    expected: TokenType,
    use: Occurrence,
    element: boolean,
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
    if (!element) return target.resolved;
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

function resolveSiblings(again: ReadAgain, followed: [LocatedReference, unknown][]): Siblings {
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

function replaced(value: unknown, property: JsonPath, part: unknown): unknown {
    const [step, ...rest] = property;
    if (step === undefined) return part;
    if (Array.isArray(value)) {
        return value.map((item, index) => (index === step ? replaced(item, rest, part) : item));
    }
    if (isJsonObject(value) && typeof step === "string") {
        return { ...value, [step]: replaced(value[step], rest, part) };
    }
    return value;
}

function startsWith(jsonPath: JsonPath, start: JsonPath): boolean {
    return start.length <= jsonPath.length && start.every((step, i) => jsonPath[i] === step);
}
