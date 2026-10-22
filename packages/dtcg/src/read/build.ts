import { relatedMessages } from "../error-messages.js";
import type {
    DesignTokens,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Group,
    ParseResult,
    Permutation,
    Place,
    Source,
    Span,
    Token,
    TokenType,
    TopLevel,
    Written,
} from "../index.js";
import { withoutRoot } from "../path.js";
import { namedPath, referenceText } from "../values/references.js";
import type { Building } from "./building.js";
import { type DiagnosticExtra, diagnostic, type Problems } from "./diagnostics.js";
import { applying, inherited } from "./inherit.js";
import {
    NO_EXTENSION_PLACES,
    NO_PLACES,
    NO_REFERENCES,
    type Places,
    linkedGroup,
    linkedPermutation,
    linkedToken,
    tokensIn,
} from "./linked.js";
import { malformation } from "./malformed-pointer.js";
import type { Merged, MergedGroup, MergedToken, MergedTopLevel, WrittenAt } from "./merge.js";
import { type MissingIn, type MissingReferences, missingReferences } from "./missing.js";
import type { NormalisedPermutation } from "./normalise.js";
import { type Occurrence, wholeReference } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./parse-value.js";
import { type ReferenceTo, linkedReference } from "./reference.js";
import { type Aim, reachOf, stepInto } from "./ref-meaning.js";
import { type Resolving, UNRESOLVED, resolveValue } from "./resolve-value.js";
import { type MadeFrom, sameGroup, sameToken } from "./same-object.js";
import { type Properties, usableType } from "./walk.js";

interface Earlier {
    tokens: Map<string, Token[]>;
    groups: Map<string, Group[]>;
}

interface Resolved {
    type: TokenType;
    read: ParseResult<unknown>;
    references: LocatedReference[];
    resolved?: unknown;
}

type WorkedOut = Resolved | "untyped";

type Whole =
    | { kind: "token"; path: string; value: WorkedOut | undefined }
    | { kind: "part" }
    | { kind: "unreachable" };

const WORKING_OUT = Symbol("working out its value");

const BEING_MADE = Symbol("being made");

type Pending<T> = T | typeof BEING_MADE;

type Aimed<Found> = Omit<ReferenceTo, "token"> & { token?: Found | undefined };

interface Context {
    readValue: ValueReader;
    diagnostics: Problems;
    places: Places;
    missing: MissingReferences;
    earlier: Earlier;
}

function earlierIn(previous: DesignTokens | undefined): Earlier {
    const earlier: Earlier = { tokens: new Map(), groups: new Map() };
    for (const permutation of previous?.permutations ?? []) {
        for (const token of permutation.tokens) remember(earlier.tokens, token.path, token);
        for (const group of permutation.groups) remember(earlier.groups, group.path, group);
    }
    return earlier;
}

export function buildPermutations(
    permutations: NormalisedPermutation[],
    readValue: ValueReader,
    diagnostics: Problems,
    places: Places,
    previous: DesignTokens | undefined,
): Permutation[] {
    const missing = missingReferences(diagnostics);
    const earlier = earlierIn(previous);
    const built = permutations.map((permutation) =>
        buildPermutation(permutation, { readValue, diagnostics, places, missing, earlier }),
    );
    missing.report();
    return built;
}

function buildPermutation(
    permutation: NormalisedPermutation,
    { readValue, diagnostics, places, missing: missingAcross, earlier }: Context,
): Permutation {
    const { input, label, contexts, sources, merged } = permutation;
    const missing = missingAcross.in(input, merged.tokens);
    const valueOf = workingOut(permutation, readValue, diagnostics, missing);

    const sourceAt = (index: number) => sources[index] as Source;
    const placed = (written: WrittenAt[], path: string | undefined): readonly Place[] => {
        const [first, ...rest] = written;
        if (!first) return NO_PLACES;
        if (rest.length === 0) return places.only(sourceAt(first.source), first.span, path);
        return written.map(({ source, span }) => places.at(sourceAt(source), span, path));
    };
    const root = publicTopLevel(merged.root, placed(merged.root.declaredIn, undefined));

    const builtTokens = new Map<string, Token>();
    const builtGroups = new Map<string, Group>();
    const beingMade = new Set<string>();
    const linkLater: (() => void)[] = [];
    const builtToken = (path: string) => builtTokens.get(path);

    const targetsOf = <Found extends Pending<Token>>(
        located: LocatedReference[],
        at: (path: string) => Found | undefined,
    ): Aimed<Found>[] => located.map(({ occurrence }) => aimAt(occurrence, merged, at));

    const targetAt = (path: string): Pending<Token> | undefined =>
        beingMade.has(path) ? BEING_MADE : tokenAt(path);

    const tokenAt = (path: string): Token | undefined => {
        const done = builtTokens.get(path);
        if (done) return done;
        const written = merged.tokens.get(path);
        if (!written) return undefined;
        const value = valueOf(written);
        if (value === "untyped") return undefined;
        const located = value.references;
        beingMade.add(path);
        const targets = targetsOf(located, targetAt);
        beingMade.delete(path);
        const { replaces, source, span } = written;
        const { read } = value;
        const now: MadeFrom = {
            type: value.type,
            value: read.ok ? read.value : undefined,
            resolved: read.ok && "resolved" in value ? value.resolved : undefined,
            invalid: read.ok ? undefined : true,
            deprecated: inherited(written, merged, "deprecated"),
            writtenAt: replaces
                ? [...placed(replaces, path), places.at(sourceAt(source), span, path)]
                : places.only(sourceAt(source), span, path),
        };
        const reached = targets.every(isAimed) ? targets : undefined;
        const kept =
            reached &&
            earlier.tokens.get(path)?.find((each) => sameToken(each, written, now, reached));
        if (kept && reached) places.movedTo(kept.references, spansOf(reached));
        const token = kept ?? newToken(written, now, located, reached);
        builtTokens.set(path, token);
        return token;
    };

    const newToken = (
        written: MergedToken,
        now: MadeFrom,
        located: LocatedReference[],
        reached: readonly Aimed<Token>[] | undefined,
    ): Token => {
        const token: Building<Token> = linkedToken(tokenFields(written, now));
        if (located.length > 0) {
            const link = (targets: readonly Aimed<Token>[]) => {
                token.references = targets.map((target) => linkedReference(token, target));
            };
            if (reached) link(reached);
            else linkLater.push(() => link(targetsOf(located, builtToken)));
        }
        remember(earlier.tokens, written.path, token);
        return token;
    };

    const childrenAt = <Found>(
        parentPath: string | undefined,
        at: (path: string) => Found | undefined,
    ): Found[] => {
        const children: Found[] = [];
        for (const path of merged.children.get(parentPath) ?? []) {
            const child = at(path);
            if (child !== undefined) children.push(child);
        }
        return children;
    };
    const childAt = (path: string) => (merged.tokens.has(path) ? tokenAt(path) : groupAt(path));

    const groupAt = (path: string): Group | undefined => {
        const done = builtGroups.get(path);
        if (done) return done;
        const written = merged.groups.get(path);
        if (!written) return undefined;
        const children = childrenAt(path, childAt);
        const extending =
            written.extendsGroup === undefined ? undefined : groupAt(written.extendsGroup);
        const applies = applying(merged, written);
        const writtenAt = placed(written.declaredIn, path);
        const kept = earlier.groups
            .get(path)
            ?.find((each) => sameGroup(each, written, applies, writtenAt, children, extending));
        if (kept && written.extends) places.movedTo(kept.references, [written.extends.span]);
        const group =
            kept ??
            newGroup(written, groupFields(written, applies, writtenAt), children, extending);
        builtGroups.set(path, group);
        return group;
    };

    const newGroup = (
        written: MergedGroup,
        fields: Parameters<typeof linkedGroup>[0],
        children: (Token | Group)[],
        extending: Group | undefined,
    ): Group => {
        const group: Building<Group> = linkedGroup(fields);
        group.children = children;
        const rootToken = children.find(
            (child): child is Token =>
                child.kind === "token" && withoutRoot(child.path) === written.path,
        );
        if (rootToken) group.rootToken = rootToken;
        if (extending) group.extends = extending;
        if (written.extends) {
            const { reference, steps, span, keyword } = written.extends;
            const target = aimAt({ reference, steps, span, property: [] }, merged, builtToken);
            const pointerAlone = keyword === "$ref";
            group.references = [linkedReference(group, target, { pointerAlone })];
        }
        remember(earlier.groups, written.path, group);
        return group;
    };

    const children = childrenAt(undefined, childAt);
    for (const path of merged.groups.keys()) groupAt(path);
    for (const link of linkLater) link();
    missing.close();
    return linkedPermutation(
        {
            input,
            label,
            sources,
            contexts,
            root,
            children,
            tokens: tokensIn(children),
            groups: [...merged.groups.keys()].flatMap((path) => builtGroups.get(path) ?? []),
        },
        builtTokens,
        builtGroups,
    );
}

function workingOut(
    { input, merged }: NormalisedPermutation,
    readValue: ValueReader,
    diagnostics: Problems,
    missing: MissingIn,
): (token: MergedToken) => WorkedOut {
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        path: string,
        span: Span,
        extra: Omit<DiagnosticExtra, "span" | "path"> = {},
    ) => diagnostics.found(diagnostic(kind, detail, { span, path, ...extra }), input);

    const notReached = (aim: Aim, from: string, span: Span) => {
        const { reference } = aim;
        if (reachOf(aim, merged).kind === "group") {
            report("not-a-token", { ref: referenceText(reference) }, from, span);
        } else missing.record(reference, from, span);
    };

    const reportUnreachable = (aim: Aim, from: string, span: Span) => {
        const { reference } = aim;
        const malformed =
            reference.syntax === "json-pointer" && malformation(reference.pointer, merged);
        if (malformed) report("malformed-pointer", malformed, from, span);
        else notReached(aim, from, span);
    };

    const workedOut = new Map<string, WorkedOut | typeof WORKING_OUT>();
    const asking: { path: string; span: Span }[] = [];

    const valueAt = (path: string, from: string, span: Span): WorkedOut | undefined => {
        const token = merged.tokens.get(path);
        if (!token) return undefined;
        asking.push({ path: from, span });
        const value = valueOf(token);
        asking.pop();
        return value;
    };

    const valueOf = (token: MergedToken): WorkedOut => {
        const { path } = token;
        const known = workedOut.get(path);
        if (known === WORKING_OUT) {
            reportLoop(path);
            return "untyped";
        }
        if (known) return known;
        workedOut.set(path, WORKING_OUT);
        const value = workOut(token);
        workedOut.set(path, value);
        return value;
    };

    const reportLoop = (path: string) => {
        const loop = asking.slice(asking.findIndex((frame) => frame.path === path));
        const [first, ...rest] = loop;
        if (!first) return;
        const chain = [...loop.map((frame) => frame.path), path];
        const related = rest.map((frame) => ({
            message: relatedMessages.partOfTheLoop,
            span: frame.span,
            path: frame.path,
        }));
        report("circular-reference", { chain }, first.path, first.span, { related });
    };

    const followWhole = (token: MergedToken, whole: Occurrence): Whole => {
        const { reference } = whole;
        if (reference.syntax === "curly-brace") {
            const { path } = reference;
            const value = valueAt(path, token.path, whole.span);
            return value === undefined ? { kind: "unreachable" } : { kind: "token", path, value };
        }
        const reached = reachOf(whole, merged);
        if (reached.kind === "token") {
            const { path } = reached;
            return { kind: "token", path, value: valueAt(path, token.path, whole.span) };
        }
        return reached.kind === "part" ? { kind: "part" } : { kind: "unreachable" };
    };

    const workOut = (token: MergedToken): WorkedOut => {
        const whole = wholeReference(token);

        let type: TokenType | undefined;
        if (token.type !== undefined || !token.reference) {
            const own = inherited(token, merged, "type");
            if (own === "unusable") return "untyped";
            if (own === undefined) {
                report("missing-type", {}, token.path, token.span);
                return "untyped";
            }
            type = own;
        }
        if (whole) {
            const followed = followWhole(token, whole);
            if (followed.kind === "unreachable") {
                reportUnreachable(whole, token.path, whole.span);
                return fallback(token, type);
            }
            if (followed.kind === "part") {
                type ??= groupType(token);
                if (type === undefined) {
                    report("missing-type", {}, token.path, token.span);
                    return "untyped";
                }
            } else {
                const target = followed.value;
                if (target === undefined || target === "untyped") return fallback(token, type);
                if (!("resolved" in target)) return unresolved(token, type ?? target.type);
                type ??= target.type;
            }
        }
        if (type === undefined) return "untyped";

        const { result: read, references, readAgain } = readValue.read(token, type, input);
        const base = { type, read, references };
        if (!read.ok) return base;
        if (references.length === 0) return { ...base, resolved: read.value };

        const value = resolveValue(resolving, token, read.value, references, readAgain);
        return value === UNRESOLVED ? base : { ...base, resolved: value };
    };

    const fallback = (token: MergedToken, type: TokenType | undefined): WorkedOut => {
        const shown = type ?? groupType(token);
        return shown === undefined ? "untyped" : unresolved(token, shown);
    };

    const groupType = (token: MergedToken): TokenType | undefined =>
        usableType(inherited(token, merged, "type"));

    const unresolved = (token: MergedToken, type: TokenType): WorkedOut => {
        const { result: read, references } = readValue.read(token, type, input);
        return { type, read, references };
    };

    const resolving: Resolving = {
        readValue,
        merged,
        input,
        valueAt,
        report,
        notReached,
        reportUnreachable,
    };

    return valueOf;
}

function remember<T>(earlier: Map<string, T[]>, path: string, each: T): void {
    const list = earlier.get(path);
    if (!list) earlier.set(path, [each]);
    else if (!list.includes(each)) list.push(each);
}

function spansOf(targets: readonly Aimed<Token>[]): Span[] {
    return targets.map(({ occurrence }) => occurrence.span);
}

function isAimed(target: Aimed<Pending<Token>>): target is Aimed<Token> {
    return target.token !== BEING_MADE;
}

function aimAt<Found extends Pending<Token>>(
    occurrence: Occurrence,
    merged: Merged,
    at: (path: string) => Found | undefined,
): Aimed<Found> {
    const { reference } = occurrence;
    if (reference.syntax === "curly-brace") {
        return { occurrence, path: reference.path, token: at(reference.path) };
    }
    const reached = reachOf(occurrence, merged);
    if (reached.kind === "nothing") return { occurrence, path: namedPath(occurrence.reference) };
    const { path } = reached;
    if (reached.kind === "token") return { occurrence, path, token: at(path) };
    if (reached.kind === "group") return { occurrence, path };
    const targetProperty = stepInto(reached.token.authored, reached.inside)?.property;
    return { occurrence, path, targetProperty };
}

function publicTopLevel(top: MergedTopLevel, writtenAt: readonly Place[]): TopLevel {
    return { ...publicProperties(top), writtenAt };
}

function groupFields(
    group: MergedGroup,
    applies: Properties,
    writtenAt: readonly Place[],
): Parameters<typeof linkedGroup>[0] {
    const { path, inherited: from } = group;
    const authored = publicProperties(group);
    return {
        path,
        ...publicProperties(applies),
        writtenAt,
        extensionsWrittenAt: extensionPlaces(group, writtenAt),
        children: [],
        references: NO_REFERENCES,
        ...(from && { inherited: from }),
        ...(Object.keys(authored).length > 0 && { authored }),
    };
}

function extensionPlaces(
    { extensionsAt, declaredIn }: MergedGroup,
    writtenAt: readonly Place[],
): Readonly<Record<string, Place>> {
    if (!extensionsAt) return NO_EXTENSION_PLACES;
    const places: Record<string, Place> = {};
    for (const [key, { source }] of Object.entries(extensionsAt)) {
        declaredIn.forEach((each, index) => {
            const place = writtenAt[index];
            if (each.source === source && place) places[key] = place;
        });
    }
    return Object.freeze(places);
}

function publicProperties({
    type: written,
    description,
    deprecated,
    extensions,
}: Properties): Written {
    const type = usableType(written);
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    };
}

function tokenFields(token: MergedToken, now: MadeFrom): Parameters<typeof linkedToken>[0] {
    return {
        path: token.path,
        type: now.type,
        references: NO_REFERENCES,
        writtenAt: now.writtenAt,
        value: now.value,
        resolved: now.resolved,
        invalid: now.invalid,
        description: token.description,
        deprecated: now.deprecated,
        extensions: token.extensions,
        authored: token.added
            ? undefined
            : {
                  value: token.authored,
                  ...publicProperties({ type: token.type, deprecated: token.deprecated }),
              },
        generated: token.generated,
        inherited: token.inherited,
    } as Parameters<typeof linkedToken>[0];
}
