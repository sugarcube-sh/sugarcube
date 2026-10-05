import { fixTitles, relatedMessages } from "../error-messages.js";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Edge,
    JsonPath,
    ParseResult,
    Permutation,
    Span,
    Token,
    TokenBase,
    TokenType,
    ValueByType,
} from "../index.js";
import { compositeParts } from "../values/composite-parts.js";
import { isJsonObject } from "../values/json.js";
import { readPointer } from "../values/references.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { inheritedDeprecation, inheritedType } from "./inherit.js";
import type { Merged, MergedToken } from "./merge.js";
import type { NormalisedPermutation, NormalisedToken } from "./normalise.js";
import type { ValueReader } from "./parse-value.js";
import { refSteps } from "./pointer.js";
import { reach } from "./ref-meaning.js";
import { similarName } from "./similar.js";
import {
    type Occurrence,
    keptReferences,
    referencesIn,
    withoutIgnored,
} from "./value-references.js";

interface Resolved {
    type: TokenType;
    read: ParseResult<unknown>;
    resolved?: unknown;
    aliasOf?: string;
}

type Outcome = Resolved | "untyped";

type Whole =
    | { kind: "token"; path: string; outcome: Outcome | undefined }
    | { kind: "part" }
    | { kind: "unreachable" };

interface Use {
    at: Span;
    isAlias: boolean;
}

interface Missing {
    first: { from: string; use: Use };
    referencedBy: string[];
    uses: Use[];
}

const UNRESOLVED = Symbol("unresolved");

export function resolvePermutations(
    permutations: NormalisedPermutation[],
    readValue: ValueReader,
    diagnostics: Diagnostic[],
): Permutation[] {
    const found = new WeakMap<MergedToken["value"], Occurrence[]>();
    const referencesOf = (token: MergedToken) => {
        if (token.added) return referencesIn(token.authored, token.value, token.json);
        const cached = found.get(token.value);
        if (cached) return cached;
        const references = referencesIn(token.authored, token.value, token.json);
        found.set(token.value, references);
        return references;
    };

    return permutations.map((permutation, index) =>
        resolvePermutation(permutation, index, { readValue, referencesOf, diagnostics }),
    );
}

interface Context {
    readValue: ValueReader;
    referencesOf: (token: MergedToken) => Occurrence[];
    diagnostics: Diagnostic[];
}

interface Walk {
    token: MergedToken;
    listItem: boolean;
    useAt: (canonical: JsonPath) => Occurrence | undefined;
}

function resolvePermutation(
    permutation: NormalisedPermutation,
    index: number,
    { readValue, referencesOf, diagnostics }: Context,
): Permutation {
    const { tokens, merged } = permutation;
    const outcomes = new Map<string, Outcome | "resolving">();
    const stack: { path: string; at: Span }[] = [];
    const missing = new Map<string, Missing>();

    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        path: string,
        at: Span,
        extra: Omit<DiagnosticExtra, "at" | "path" | "permutation"> = {},
    ) => diagnostics.push(diagnostic(kind, detail, { at, path, permutation: index, ...extra }));

    const recordMissing = (ref: string, from: string, use: Use) => {
        const entry = missing.get(ref) ?? { first: { from, use }, referencedBy: [], uses: [] };
        if (!entry.referencedBy.includes(from)) entry.referencedBy.push(from);
        entry.uses.push(use);
        missing.set(ref, entry);
    };

    const reportUnreachable = (use: Occurrence, from: string) => {
        const ref = use.kind === "alias" ? use.target : use.written;
        const isGroup =
            use.kind === "alias"
                ? merged.groups.has(use.target)
                : reach(use.steps, merged).kind === "group";
        if (isGroup) report("not-a-token", { ref }, from, use.at);
        else recordMissing(ref, from, { at: use.at, isAlias: use.kind === "alias" });
    };

    const outcomeOf = (path: string, from: string, at: Span): Outcome | undefined => {
        const entry = tokens.get(path);
        if (!entry) return merged.tokens.has(path) ? "untyped" : undefined;
        stack.push({ path: from, at });
        const outcome = resolveToken(entry);
        stack.pop();
        return outcome;
    };

    const resolveToken = (entry: NormalisedToken): Outcome => {
        const { path } = entry.token;
        const current = outcomes.get(path);
        if (current === "resolving") {
            const loop = stack.slice(stack.findIndex((frame) => frame.path === path));
            const [first, ...rest] = loop;
            if (first) {
                const chain = [...loop.map((frame) => frame.path), path];
                const related = rest.map((frame) => ({
                    message: relatedMessages.partOfTheLoop,
                    at: frame.at,
                }));
                report("circular-reference", { chain }, first.path, first.at, { related });
            }
            return "untyped";
        }
        if (current) return current;
        outcomes.set(path, "resolving");
        const outcome = compute(entry);
        outcomes.set(path, outcome);
        return outcome;
    };

    const followWhole = (token: MergedToken, whole: Occurrence): Whole => {
        if (whole.kind === "alias") {
            const outcome = outcomeOf(whole.target, token.path, whole.at);
            return { kind: "token", path: whole.target, outcome };
        }
        const reached = reach(whole.steps, merged);
        if (reached.kind === "token" || (reached.kind === "part" && reached.inside.length === 0)) {
            const { path } = reached;
            return { kind: "token", path, outcome: outcomeOf(path, token.path, whole.at) };
        }
        return reached.kind === "part" ? { kind: "part" } : { kind: "unreachable" };
    };

    const compute = (entry: NormalisedToken): Outcome => {
        const { token } = entry;
        const references = referencesOf(token);
        const whole = references.find((each) => each.path.length === 0);

        let type = entry.type;
        let aliasOf: string | undefined;
        if (whole) {
            const followed = followWhole(token, whole);
            if (followed.kind === "unreachable") {
                reportUnreachable(whole, token.path);
                return fallback(entry, type);
            }
            if (followed.kind === "part") {
                type ??= groupType(token);
                if (type === undefined) {
                    report("missing-type", {}, token.path, token.at);
                    return "untyped";
                }
            } else {
                const target = followed.outcome;
                if (target === undefined) reportUnreachable(whole, token.path);
                if (target === undefined || target === "untyped") return fallback(entry, type);
                if (!("resolved" in target)) return unresolved(entry, type ?? target.type);
                type ??= target.type;
                aliasOf = target.aliasOf ?? followed.path;
            }
        }
        if (type === undefined) return "untyped";

        const read = entry.read ?? readValue.read(token, type);
        const base = { type, read, ...(aliasOf !== undefined && { aliasOf }) };
        if (!read.ok) return base;
        const kept = keptReferences(references, read.ignored);
        if (kept.length === 0) return { ...base, resolved: read.value };

        let parsed: unknown = read.value;
        if (kept.some((each) => each.kind === "pointer")) {
            const authored = withoutIgnored(token.authored, read.ignored);
            const replaced = replacePointers(authored, token, []);
            if (replaced === UNRESOLVED) return base;
            const again = readValue.readReplaced(token, type, replaced, index);
            if (!again.ok) return base;
            parsed = again.value;
        }

        const singleShadow = type === "shadow" && !Array.isArray(token.authored);
        const useAt = (canonical: JsonPath) => {
            const written = singleShadow ? canonical.slice(1) : canonical;
            let closest: Occurrence | undefined;
            for (const each of kept) {
                const holds = each.path.every((step, i) => written[i] === step);
                if (holds && (!closest || each.path.length > closest.path.length)) closest = each;
            }
            return closest;
        };
        const value = resolveValue(parsed, type, [], { token, listItem: false, useAt });
        return value === UNRESOLVED ? base : { ...base, resolved: value };
    };

    const fallback = (entry: NormalisedToken, type: TokenType | undefined): Outcome => {
        const shown = type ?? groupType(entry.token);
        return shown === undefined ? "untyped" : unresolved(entry, shown);
    };

    const groupType = (token: MergedToken): TokenType | undefined => {
        const type = inheritedType(token, merged);
        return type === "unusable" ? undefined : type;
    };

    const unresolved = (entry: NormalisedToken, type: TokenType): Outcome => {
        const read = entry.read ?? readValue.read(entry.token, type);
        return { type, read };
    };

    const replacePointers = (raw: unknown, token: MergedToken, seen: string[]): unknown => {
        const pointer = readPointer(raw);
        if (pointer) {
            const { pointer: written } = pointer;
            const use = referencesOf(token).find(
                (each) => each.kind === "pointer" && each.written === written,
            );
            if (seen.includes(written)) {
                report(
                    "circular-reference",
                    { chain: [...seen, written] },
                    token.path,
                    use?.at ?? token.at,
                );
                return UNRESOLVED;
            }
            const part = pointedAt(refSteps(written));
            if (part === UNRESOLVED) {
                if (use) reportUnreachable(use, token.path);
                return UNRESOLVED;
            }
            return replacePointers(part, token, [...seen, written]);
        }
        if (Array.isArray(raw)) {
            const items = raw.map((each) => replacePointers(each, token, seen));
            return items.includes(UNRESOLVED) ? UNRESOLVED : items;
        }
        if (isJsonObject(raw)) {
            const entries = Object.entries(raw).map(([key, each]) => [
                key,
                replacePointers(each, token, seen),
            ]);
            return entries.some(([, each]) => each === UNRESOLVED)
                ? UNRESOLVED
                : Object.fromEntries(entries);
        }
        return raw;
    };

    const pointedAt = (steps: string[] | undefined): unknown => {
        const reached = reach(steps, merged);
        if (reached.kind === "token") return reached.token.authored;
        if (reached.kind === "part") return stepInto(reached.token.authored, reached.inside);
        return UNRESOLVED;
    };

    const resolveValue = (value: unknown, type: TokenType, path: JsonPath, walk: Walk): unknown => {
        const alias = aliasIn(value);
        if (alias !== undefined) return substitute(alias, type, path, walk);
        if (type === "shadow" || type === "gradient") {
            if (!Array.isArray(value)) return value;
            const items = value.map((item, i) => {
                const itemAlias = aliasIn(item);
                return itemAlias !== undefined
                    ? substitute(itemAlias, type, [...path, i], { ...walk, listItem: true })
                    : resolveParts(item, compositeParts[type], [...path, i], walk);
            });
            return items.includes(UNRESOLVED) ? UNRESOLVED : items;
        }
        if (type === "border" || type === "transition" || type === "typography") {
            return resolveParts(value, compositeParts[type], path, walk);
        }
        if (type === "strokeStyle" && isJsonObject(value) && Array.isArray(value.dashArray)) {
            const dashArray = value.dashArray.map((item, i) =>
                resolveValue(item, "dimension", [...path, "dashArray", i], walk),
            );
            return dashArray.includes(UNRESOLVED) ? UNRESOLVED : { ...value, dashArray };
        }
        return value;
    };

    const resolveParts = (
        value: unknown,
        parts: Readonly<Record<string, TokenType | "boolean">>,
        path: JsonPath,
        walk: Walk,
    ): unknown => {
        if (!isJsonObject(value)) return value;
        const entries = Object.entries(value).map(([key, part]) => {
            const partType = parts[key];
            if (partType === undefined || partType === "boolean") return [key, part];
            return [key, resolveValue(part, partType, [...path, key], walk)];
        });
        return entries.some(([, each]) => each === UNRESOLVED)
            ? UNRESOLVED
            : Object.fromEntries(entries);
    };

    const substitute = (ref: string, expected: TokenType, path: JsonPath, walk: Walk): unknown => {
        const { token, listItem, useAt } = walk;
        const use = useAt(path);
        const at = use?.at ?? token.at;
        const target = outcomeOf(ref, token.path, at);
        if (target === undefined) {
            if (merged.groups.has(ref)) report("not-a-token", { ref }, token.path, at);
            else recordMissing(ref, token.path, { at, isAlias: use?.kind === "alias" });
            return UNRESOLVED;
        }
        if (target === "untyped" || !("resolved" in target)) return UNRESOLVED;
        if (target.type !== expected) {
            report("type-mismatch", { ref, expected, found: target.type }, token.path, at);
            return UNRESOLVED;
        }
        if (!listItem) return target.resolved;
        const list = Array.isArray(target.resolved) ? target.resolved : [target.resolved];
        if (list.length !== 1) {
            report("reference-to-several", { ref, count: list.length }, token.path, at);
            return UNRESOLVED;
        }
        return list[0];
    };

    const built: Token[] = [];
    const edges: Edge[] = [];
    for (const [path, entry] of tokens) {
        const outcome = resolveToken(entry);
        if (outcome === "untyped") continue;
        built.push(toToken(entry.token, outcome, merged));
        if (!outcome.read.ok) continue;
        for (const use of keptReferences(referencesOf(entry.token), outcome.read.ignored)) {
            edges.push({ from: path, to: targetOf(use, merged), at: use.at });
        }
    }

    const knownPaths = [...tokens.keys()];
    for (const [ref, { first, referencedBy, uses }] of missing) {
        const similar = similarName(ref, knownPaths);
        const edits = uses.flatMap(({ isAlias, at }) =>
            isAlias && similar !== undefined
                ? [
                      {
                          file: at.file,
                          offset: at.offset,
                          length: at.length,
                          text: JSON.stringify(`{${similar}}`),
                      },
                  ]
                : [],
        );
        const related = uses
            .filter((use) => use !== first.use)
            .map((use) => ({ message: relatedMessages.alsoUsedHere, at: use.at }));
        report("missing-reference", { ref, referencedBy }, first.from, first.use.at, {
            ...(related.length > 0 && { related }),
            ...(similar !== undefined &&
                edits.length > 0 && {
                    fixes: [{ title: fixTitles.useSimilar(similar), safe: false, edits }],
                }),
        });
    }

    const { input, label, sources, groups } = permutation;
    return { input, label, sources, tokens: built, groups, edges };
}

function targetOf(use: Occurrence, merged: Merged): string {
    if (use.kind === "alias") return use.target;
    const reached = reach(use.steps, merged);
    return reached.kind === "nothing" ? use.written : reached.path;
}

function stepInto(raw: unknown, steps: string[]): unknown {
    let current = raw;
    for (const step of steps) {
        if (Array.isArray(current) && /^(?:0|[1-9]\d*)$/.test(step))
            current = current[Number(step)];
        else if (isJsonObject(current) && Object.hasOwn(current, step)) current = current[step];
        else return UNRESOLVED;
        if (current === undefined) return UNRESOLVED;
    }
    return current;
}

function aliasIn(value: unknown): string | undefined {
    if (!isJsonObject(value)) return undefined;
    const keys = Object.keys(value);
    return keys.length === 1 && typeof value.alias === "string" ? value.alias : undefined;
}

function toToken<T extends TokenType>(
    token: MergedToken,
    outcome: Resolved & { type: T },
    merged: Merged,
): Token {
    const deprecated = inheritedDeprecation(token, merged);
    const built: TokenBase<T> = {
        path: token.path,
        type: outcome.type,
        ...(token.description !== undefined && { description: token.description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(token.extensions && { extensions: token.extensions }),
        source: { index: token.piece.source, at: token.at },
        ...(!token.added && {
            authored: { value: token.authored, typeDeclared: token.type !== undefined },
        }),
        ...(token.generated && { generated: token.generated }),
        ...(token.inherited && { inherited: token.inherited }),
        ...(outcome.aliasOf !== undefined && { aliasOf: outcome.aliasOf }),
    };
    if (!outcome.read.ok) built.invalid = true;
    else {
        built.value = outcome.read.value as TokenBase<T>["value"];
        if ("resolved" in outcome) built.resolved = outcome.resolved as ValueByType[T];
    }
    return built as Token;
}
