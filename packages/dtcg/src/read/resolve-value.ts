import type {
    DiagnosticDetailByKind,
    DiagnosticKind,
    JsonPath,
    Span,
    TokenType,
} from "../index.js";
import { isJsonObject } from "../values/json.js";
import type { ReadAgain } from "../values/read-syntax.js";
import type { Siblings } from "../values/syntax.js";
import type { MergedToken, Merged } from "./merge.js";
import { type Occurrence, occurrence } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./parse-value.js";
import { refSteps } from "./pointer.js";
import { reach } from "./ref-meaning.js";

export const UNRESOLVED = Symbol("unresolved");

export type Target = "untyped" | { type: TokenType; resolved?: unknown };

export interface Resolving {
    readValue: ValueReader;
    merged: Merged;
    permutation: number;
    outcomeOf(path: string, from: string, at: Span): Target | undefined;
    report<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        path: string,
        at: Span,
    ): void;
    recordMissing(ref: string, from: string, use: { at: Span; isAlias: boolean }): void;
    reportUnreachable(use: Occurrence, from: string): void;
}

interface Following {
    token: MergedToken;
    seen: string[];
    within: Occurrence | undefined;
}

export function resolveValue(
    resolving: Resolving,
    token: MergedToken,
    value: unknown,
    references: LocatedReference[],
    readAgain: ReadAgain[],
): unknown {
    const following = { token, seen: [], within: undefined };
    return resolveIn(resolving, following, value, references, readAgain);
}

function resolveIn(
    resolving: Resolving,
    following: Following,
    value: unknown,
    references: LocatedReference[],
    readAgain: ReadAgain[],
): unknown {
    const followed: [LocatedReference, unknown][] = [];
    let resolved = value;
    let failed = false;
    for (const located of references) {
        const { place } = located.reference;
        if (readAgain.some((each) => startsWith(place, each.place))) continue;
        const part = follow(resolving, following, located);
        if (part === UNRESOLVED) failed = true;
        else {
            followed.push([located, part]);
            resolved = replaced(resolved, place, part);
        }
    }
    if (failed) return UNRESOLVED;

    const { readValue, permutation } = resolving;
    const { token, within } = following;
    for (const again of readAgain) {
        const { at, owner, raw } = again;
        const syntax = again.from(siblingsOf(again, followed));
        const place = { syntax, at, owner, element: false };
        const { result, notes } = readValue.readTarget(token, place, raw, permutation);
        if (!result.ok) return UNRESOLVED;
        const inner = notes.references.map((reference) => ({
            reference,
            occurrence: within ?? occurrence(token, reference),
        }));
        const part = resolveIn(resolving, following, result.value, inner, notes.readAgain);
        if (part === UNRESOLVED) return UNRESOLVED;
        resolved = replaced(resolved, again.place, part);
    }
    return resolved;
}

function follow(resolving: Resolving, following: Following, located: LocatedReference): unknown {
    const { merged, readValue, permutation, report, recordMissing, reportUnreachable } = resolving;
    const { token, seen, within } = following;
    const { ref, syntax, owner, element, at } = located.reference;
    const use = within ?? located.occurrence;
    const expected = syntax.kind === "ofType" ? syntax.type : owner;
    const adjusted = (part: unknown) =>
        part !== UNRESOLVED && syntax.kind === "ofType" && syntax.adjust
            ? syntax.adjust(part)
            : part;

    if ("alias" in ref) {
        const target = { path: ref.alias, shown: ref.alias };
        return adjusted(substitute(resolving, token, target, expected, use, element));
    }

    const { pointer: written } = ref;
    if (seen.includes(written)) {
        report("circular-reference", { chain: [...seen, written] }, token.path, use.at);
        return UNRESOLVED;
    }
    const reached = reach(refSteps(written), merged);
    const unreachable = () => {
        if (!within) reportUnreachable(located.occurrence, token.path);
        else if (reached.kind === "group") {
            report("not-a-token", { ref: written }, token.path, use.at);
        } else recordMissing(written, token.path, { at: use.at, isAlias: false });
        return UNRESOLVED;
    };
    if (reached.kind === "group" || reached.kind === "nothing") return unreachable();

    const whole = reached.kind === "token" || reached.inside.length === 0;
    if (whole && (syntax.kind === "ofType" || element)) {
        const target = { path: reached.path, shown: written };
        return adjusted(substitute(resolving, token, target, expected, use, element));
    }
    const { authored } = reached.token;
    const raw = whole ? authored : stepInto(authored, reached.inside);
    if (raw === UNRESOLVED) return unreachable();

    const place = { syntax, at, owner, element };
    const { result, notes } = readValue.readTarget(token, place, raw, permutation);
    if (!result.ok) return UNRESOLVED;
    const inner = notes.references.map((reference) => ({ reference, occurrence: use }));
    const deeper = { token, seen: [...seen, written], within: use };
    return resolveIn(resolving, deeper, result.value, inner, notes.readAgain);
}

function substitute(
    { outcomeOf, merged, report, recordMissing }: Resolving,
    token: MergedToken,
    { path, shown }: { path: string; shown: string },
    expected: TokenType,
    use: Occurrence,
    element: boolean,
): unknown {
    const { at } = use;
    const target = outcomeOf(path, token.path, at);
    if (target === undefined) {
        if (merged.groups.has(path)) report("not-a-token", { ref: shown }, token.path, at);
        else recordMissing(shown, token.path, { at, isAlias: use.kind === "alias" });
        return UNRESOLVED;
    }
    if (target === "untyped" || !("resolved" in target)) return UNRESOLVED;
    if (target.type !== expected) {
        report("type-mismatch", { ref: shown, expected, found: target.type }, token.path, at);
        return UNRESOLVED;
    }
    if (!element) return target.resolved;
    const list = Array.isArray(target.resolved) ? target.resolved : [target.resolved];
    if (list.length !== 1) {
        report("reference-to-several", { ref: shown, count: list.length }, token.path, at);
        return UNRESOLVED;
    }
    return list[0];
}

function siblingsOf(again: ReadAgain, followed: [LocatedReference, unknown][]): Siblings {
    const parent = again.place.slice(0, -1);
    const siblings: Record<string, unknown> = { ...again.siblings };
    for (const [{ reference }, part] of followed) {
        const { place } = reference;
        const name = place.at(-1);
        const beside = place.length === again.place.length && startsWith(place, parent);
        if (beside && typeof name === "string") siblings[name] = part;
    }
    return siblings;
}

function replaced(value: unknown, place: JsonPath, part: unknown): unknown {
    const [step, ...rest] = place;
    if (step === undefined) return part;
    if (Array.isArray(value)) {
        return value.map((item, index) => (index === step ? replaced(item, rest, part) : item));
    }
    if (isJsonObject(value) && typeof step === "string") {
        return { ...value, [step]: replaced(value[step], rest, part) };
    }
    return value;
}

function stepInto(raw: unknown, steps: string[]): unknown {
    let current = raw;
    for (const step of steps) {
        if (Array.isArray(current) && /^(?:0|[1-9]\d*)$/.test(step)) {
            current = current[Number(step)];
        } else if (isJsonObject(current) && Object.hasOwn(current, step)) current = current[step];
        else return UNRESOLVED;
        if (current === undefined) return UNRESOLVED;
    }
    return current;
}

function startsWith(path: JsonPath, start: JsonPath): boolean {
    return start.length <= path.length && start.every((step, i) => path[i] === step);
}
