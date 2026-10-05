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
import { isJsonObject } from "../values/json.js";
import type { Recheck } from "../values/read-shape.js";
import type { Siblings } from "../values/shape.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { inheritedDeprecation, inheritedType } from "./inherit.js";
import type { Merged, MergedToken } from "./merge.js";
import type { NormalisedPermutation, NormalisedToken } from "./normalise.js";
import type { Reference, ValueReader } from "./parse-value.js";
import { malformation } from "./malformed-pointer.js";
import { refSteps } from "./pointer.js";
import { reach } from "./ref-meaning.js";
import { similarName } from "./similar.js";
import { type Occurrence, occurrence, wholeReference } from "./occurrence.js";

interface Resolved {
    type: TokenType;
    read: ParseResult<unknown>;
    references: Reference[];
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
    return permutations.map((permutation, index) =>
        resolvePermutation(permutation, index, { readValue, diagnostics }),
    );
}

interface Context {
    readValue: ValueReader;
    diagnostics: Diagnostic[];
}

function resolvePermutation(
    permutation: NormalisedPermutation,
    index: number,
    { readValue, diagnostics }: Context,
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
        const malformed =
            use.kind === "pointer" && malformation(use.written, use.pointerAt, merged);
        if (malformed) {
            const { detail, fixes } = malformed;
            report("malformed-pointer", detail, from, use.at, fixes && { fixes });
            return;
        }
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
        const whole = wholeReference(token);

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

        const { result: read, references, rechecks } = entry.read ?? readValue.read(token, type);
        const base = { type, read, references, ...(aliasOf !== undefined && { aliasOf }) };
        if (!read.ok) return base;
        if (references.length === 0) return { ...base, resolved: read.value };

        const value = resolveValue(token, read.value, references, rechecks, [], undefined);
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
        const { result: read, references } = entry.read ?? readValue.read(entry.token, type);
        return { type, read, references };
    };

    const resolveValue = (
        token: MergedToken,
        value: unknown,
        references: Reference[],
        rechecks: Recheck[],
        seen: string[],
        within: Occurrence | undefined,
    ): unknown => {
        const later = (place: JsonPath) => rechecks.some((each) => startsWith(place, each.place));
        const followed = new Map<Reference, unknown>();
        let resolved = value;
        for (const reference of references) {
            if (later(reference.found.place)) continue;
            const part = follow(token, reference, seen, within);
            followed.set(reference, part);
            if (part !== UNRESOLVED) resolved = replaced(resolved, reference.found.place, part);
        }
        if ([...followed.values()].includes(UNRESOLVED)) return UNRESOLVED;

        for (const recheck of rechecks) {
            const { at, owner, raw } = recheck;
            const shape = recheck.from(resolvedSiblings(recheck, followed));
            const again = readValue.readTarget(
                token,
                { shape, at, owner, element: false },
                raw,
                index,
            );
            if (!again.result.ok) return UNRESOLVED;
            const inner = again.noted.found.map((found) => ({
                found,
                use: within ?? occurrence(token, found),
            }));
            const part = resolveValue(
                token,
                again.result.value,
                inner,
                again.noted.rechecks,
                seen,
                within,
            );
            if (part === UNRESOLVED) return UNRESOLVED;
            resolved = replaced(resolved, recheck.place, part);
        }
        return resolved;
    };

    const follow = (
        token: MergedToken,
        { found, use: own }: Reference,
        seen: string[],
        within: Occurrence | undefined,
    ): unknown => {
        const { ref, shape, owner, element } = found;
        const use = within ?? own;
        const expected = shape.kind === "token" ? shape.type : owner;
        const adjusted = (part: unknown) =>
            part !== UNRESOLVED && shape.kind === "token" && shape.adjust
                ? shape.adjust(part)
                : part;
        if ("alias" in ref) {
            return adjusted(substitute(token, ref.alias, ref.alias, expected, use, element));
        }

        const { pointer: written } = ref;
        if (seen.includes(written)) {
            report("circular-reference", { chain: [...seen, written] }, token.path, use.at);
            return UNRESOLVED;
        }
        const reached = reach(refSteps(written), merged);
        const unreachable = () => {
            if (!within) reportUnreachable(own, token.path);
            else if (reached.kind === "group")
                report("not-a-token", { ref: written }, token.path, use.at);
            else recordMissing(written, token.path, { at: use.at, isAlias: false });
            return UNRESOLVED;
        };
        if (reached.kind === "group" || reached.kind === "nothing") return unreachable();
        const whole = reached.kind === "token" || reached.inside.length === 0;
        if (whole && (shape.kind === "token" || element)) {
            return adjusted(substitute(token, reached.path, written, expected, use, element));
        }
        const target = whole
            ? reached.token.authored
            : stepInto(reached.token.authored, reached.inside);
        if (target === UNRESOLVED) return unreachable();
        const again = readValue.readTarget(
            token,
            { shape, at: found.at, owner, element },
            target,
            index,
        );
        if (!again.result.ok) return UNRESOLVED;
        const inner = again.noted.found.map((each) => ({ found: each, use }));
        const { value } = again.result;
        return resolveValue(token, value, inner, again.noted.rechecks, [...seen, written], use);
    };

    const substitute = (
        token: MergedToken,
        path: string,
        shown: string,
        expected: TokenType,
        use: Occurrence,
        element: boolean,
    ): unknown => {
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
    };

    const built: Token[] = [];
    const edges: Edge[] = [];
    for (const [path, entry] of tokens) {
        const outcome = resolveToken(entry);
        if (outcome === "untyped") continue;
        built.push(toToken(entry.token, outcome, merged));
        if (!outcome.read.ok) continue;
        for (const { use } of outcome.references) {
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

function startsWith(path: JsonPath, start: JsonPath): boolean {
    return start.length <= path.length && start.every((step, i) => path[i] === step);
}

function resolvedSiblings(recheck: Recheck, followed: Map<Reference, unknown>): Siblings {
    const parent = recheck.place.slice(0, -1);
    const siblings: Record<string, unknown> = { ...recheck.siblings };
    for (const [{ found }, part] of followed) {
        const name = found.place.at(-1);
        const beside =
            found.place.length === recheck.place.length && startsWith(found.place, parent);
        if (beside && typeof name === "string") siblings[name] = part;
    }
    return siblings;
}
