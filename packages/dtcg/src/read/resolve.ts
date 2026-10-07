import { fixTitles, relatedMessages } from "../error-messages.js";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Edge,
    ParseResult,
    Permutation,
    Span,
    Token,
    TokenBase,
    TokenType,
    ValueByType,
} from "../index.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { inheritedDeprecation, inheritedType } from "./inherit.js";
import type { Merged, MergedToken } from "./merge.js";
import type { NormalisedPermutation, NormalisedToken } from "./normalise.js";
import type { LocatedReference, ValueReader } from "./parse-value.js";
import { malformation } from "./malformed-pointer.js";
import { reach } from "./ref-meaning.js";
import { similarName } from "./similar.js";
import { type Occurrence, wholeReference } from "./occurrence.js";
import { type Resolving, UNRESOLVED, resolveValue } from "./resolve-value.js";

interface Resolved {
    type: TokenType;
    read: ParseResult<unknown>;
    references: LocatedReference[];
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

        const { result: read, references, readAgain } = entry.read ?? readValue.read(token, type);
        const base = { type, read, references, ...(aliasOf !== undefined && { aliasOf }) };
        if (!read.ok) return base;
        if (references.length === 0) return { ...base, resolved: read.value };

        const value = resolveValue(resolving, token, read.value, references, readAgain);
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

    const resolving: Resolving = {
        readValue,
        merged,
        permutation: index,
        outcomeOf,
        report,
        recordMissing,
        reportUnreachable,
    };

    const built: Token[] = [];
    const edges: Edge[] = [];
    for (const [path, entry] of tokens) {
        const outcome = resolveToken(entry);
        if (outcome === "untyped") continue;
        built.push(toToken(entry.token, outcome, merged));
        if (!outcome.read.ok) continue;
        for (const { occurrence } of outcome.references) {
            edges.push({ from: path, to: targetOf(occurrence, merged), at: occurrence.at });
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
        const detail = { ref, referencedBy, ...(similar !== undefined && { similar }) };
        report("missing-reference", detail, first.from, first.use.at, {
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
