import {
    type DesignTokens,
    type Group,
    type Input,
    type JsonValue,
    type Permutation,
    PermutationError,
    type Permutations,
    type Place,
    type PlaceInPermutations,
    type ResolverContext,
    type Source,
    type Span,
    type Token,
    parentOf,
} from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import { refused } from "./error-messages.js";
import type { OpResult, PlaceOptions, Question, Refusal, Where } from "./index.js";
import { type Member, memberAt, writtenIn } from "./file-text.js";

interface Choice {
    path: string;
    files: readonly string[];
}

export function asked(
    { path, files }: Choice,
    answer: (file: string) => OpResult,
): {
    question: Question;
} {
    return { question: { kind: "placement", path, files, answer } };
}

type Placement =
    | { at: Member; alsoAffects: Permutations }
    | { token: Token; into: string; alsoAffects: Permutations }
    | { choose: Choice }
    | { refused: Refusal };

type NewPlace =
    | { into: string; alsoAffects: Permutations }
    | { choose: Choice }
    | { refused: Refusal };

interface Copy extends Member {
    readers: number;
}

type Copies =
    | { of: "token" | "group"; places: Copy[]; alsoAffects: Permutations }
    | { refused: Refusal };

interface Chosen {
    perm: Permutation;
    context: ResolverContext;
}

export function placement(
    tokens: DesignTokens,
    path: string,
    where: PlaceOptions,
    place?: string,
): Placement {
    if (where.at) return writtenPlace(tokens, path, where.at);
    const chosen = chosenContext(tokens, where.input ?? {});
    if (chosen === undefined) return sharedPlace(tokens, path);
    if ("refused" in chosen) return chosen;
    return contextPlace(tokens, path, chosen, place);
}

export function newPlace(
    tokens: DesignTokens,
    path: string,
    where: Where = {},
    place?: string,
): NewPlace {
    const chosen = chosenContext(tokens, where.input ?? {});
    if (chosen && "refused" in chosen) return chosen;
    return chosen
        ? newContextPlace(tokens, path, chosen, place)
        : newSharedPlace(tokens, path, place);
}

export function copiesOf(tokens: DesignTokens, path: string): Copies {
    const found = lookUp(tokens, path, (perm) => perm.token(path) ?? perm.group(path));
    if ("refused" in found) return found;
    const places = tokens.writtenAt(path).flatMap(({ span, readIn }) => {
        const member = memberAt(tokens, span);
        if (!member) return [];
        return [{ ...member, readers: readIn.length }];
    });
    const alsoAffects = alsoIn(
        tokens.permutations.where((perm) => (perm.token(path) ?? perm.group(path)) !== undefined),
    );
    return { of: found.of, places, alsoAffects };
}

export function propertyPlace(
    tokens: DesignTokens,
    path: string,
    key: string,
    places: Copy[],
    place: string | undefined,
): { at: Member; alsoAffects: Permutations } | { choose: Choice } | { refused: Refusal } {
    const writes = (member: Member) =>
        writtenIn(tokens, member.span.file, [...member.jsonPath, key]) !== undefined;
    const writing = places.find(writes);
    if (writing) return { at: writing, alsoAffects: seenReading(tokens, [writing.span.file]) };
    return widestPlace(tokens, path, places, place);
}

function widestPlace(
    tokens: DesignTokens,
    path: string,
    places: Copy[],
    place: string | undefined,
): { at: Member; alsoAffects: Permutations } | { choose: Choice } | { refused: Refusal } {
    const most = Math.max(...places.map(({ readers }) => readers));
    const widest = places.filter(({ readers }) => readers === most);
    const file = chosenFile(path, unique(widest.map(({ span }) => span)), [], place);
    if (typeof file !== "string") return file;
    const at = widest.find(({ span }) => span.file === file);
    if (!at) return refused({ kind: "not-found", path });
    return { at, alsoAffects: seenReading(tokens, [file]) };
}

export function ownProperties(token: Token): Record<string, JsonValue> {
    const own = token.valueFrom.written;
    return isJsonObject(own) ? (own as Record<string, JsonValue>) : {};
}

type ExtensionPlace =
    | { at: Member; inForce?: JsonValue; alsoAffects: Permutations }
    | { into: string; inForce: JsonValue | undefined; alsoAffects: Permutations }
    | { choose: Choice }
    | { refused: Refusal };

export function extensionPlace(
    tokens: DesignTokens,
    path: string,
    key: string,
    where: PlaceOptions,
    place?: string,
): ExtensionPlace {
    const copies = copiesOf(tokens, path);
    if ("refused" in copies) return copies;
    if (where.at) {
        const at = copies.places.find(({ span }) => sameSpan(span, where.at));
        if (!at) return refused({ kind: "not-written-there", path, at: where.at });
        return { at, alsoAffects: seenReading(tokens, [at.span.file]) };
    }
    const chosen = chosenContext(tokens, where.input ?? {});
    if (chosen && "refused" in chosen) return chosen;
    return chosen
        ? contextExtensionPlace(tokens, path, key, chosen, place)
        : sharedExtensionPlace(tokens, path, key, copies.places, place);
}

function extendedPlace(group: Group | undefined, key: string): Place | undefined {
    for (let from = group?.extends; from; from = from.extends) {
        const place = from.extensionsWrittenAt[key];
        if (place) return place;
    }
    return undefined;
}

function extensionIn(written: JsonValue | undefined, key: string): JsonValue | undefined {
    const extensions = isJsonObject(written) ? written.$extensions : undefined;
    return isJsonObject(extensions) ? extensions[key] : undefined;
}

function sharedExtensionPlace(
    tokens: DesignTokens,
    path: string,
    key: string,
    copies: Copy[],
    place: string | undefined,
): ExtensionPlace {
    const ownIn = (perm: Permutation) => perm.group(path)?.extensionsWrittenAt[key];
    const own = tokens.permutations.flatMap((perm) => ownIn(perm) ?? []);
    if (own.length > 0) {
        const shared = own.find(({ source }) => everyoneReads(source));
        const at = shared && memberAt(tokens, tokens.spanOf(shared));
        if (!shared || !at) return refused({ kind: "no-shared-value", path });
        return {
            at,
            alsoAffects: alsoIn(tokens.permutations.where((perm) => ownIn(perm) === shared)),
        };
    }
    const taken = tokens.permutations.flatMap((perm) => extendedPlace(perm.group(path), key) ?? []);
    if (taken.length === 0) return widestPlace(tokens, path, copies, place);
    const [shared] = taken;
    const same = taken.every((each) => each === shared);
    if (!shared || !same || !everyoneReads(shared.source)) {
        return refused({ kind: "no-shared-value", path });
    }
    const placed = widestPlace(tokens, path, copies, place);
    return "at" in placed ? { ...placed, inForce: extensionIn(shared.written, key) } : placed;
}

function contextExtensionPlace(
    tokens: DesignTokens,
    path: string,
    key: string,
    chosen: Chosen,
    place: string | undefined,
): ExtensionPlace {
    const { perm } = chosen;
    const group = perm.group(path);
    if (!group) return refused({ kind: "not-found", path });
    const winner = group.extensionsWrittenAt[key];
    const winnerSpan = winner && tokens.spanOf(winner);
    if (winner && winnerSpan && winner.source.context === chosen.context) {
        const at = memberAt(tokens, winnerSpan);
        if (!at) return refused({ kind: "not-found", path });
        return { at, alsoAffects: seenReading(tokens, [winnerSpan.file], chosen) };
    }
    const groupSpans = group.writtenAt.map((each) => tokens.spanOf(each));
    const winnerAt = winner && winnerSpan && { source: winner.source, span: winnerSpan };
    const into = overrideFile(path, chosen, winnerAt, groupSpans, place);
    if (typeof into !== "string") return into;
    const inForce = extensionIn((winner ?? extendedPlace(group, key))?.written, key);
    return { into, inForce, alsoAffects: seenReading(tokens, [into], chosen) };
}

function lookUp(
    tokens: DesignTokens,
    path: string,
    find: (perm: Permutation) => Token | Group | undefined,
): { of: "token" | "group" } | { refused: Refusal } {
    const found = tokens.permutations.flatMap((perm) => find(perm) ?? []);
    if (found.length === 0) return refused({ kind: "not-found", path });
    for (const each of found) {
        const refusal = refusalFor(each);
        if (refusal) return refusal;
    }
    return { of: found.some(({ kind }) => kind === "token") ? "token" : "group" };
}

function sharedPlace(tokens: DesignTokens, path: string): Placement {
    const found = lookUp(tokens, path, (perm) => perm.token(path));
    if ("refused" in found) return found;
    let shared: PlaceInPermutations | undefined;
    for (const place of tokens.writtenAt(path)) {
        if (place.sources.some(everyoneReads)) shared = place;
    }
    const at = shared && memberAt(tokens, shared.span);
    if (!shared || !at) return refused({ kind: "no-shared-value", path });
    return { at, alsoAffects: alsoIn(shared.winsIn) };
}

function writtenPlace(
    tokens: DesignTokens,
    path: string,
    at: Pick<Span, "file" | "offset" | "length">,
): Placement {
    const found = lookUp(tokens, path, (perm) => perm.token(path));
    if ("refused" in found) return found;
    const there = tokens.writtenAt(path).find(({ span }) => sameSpan(span, at));
    const member = there && memberAt(tokens, there.span);
    if (!there || !member) return refused({ kind: "not-written-there", path, at });
    return { at: member, alsoAffects: alsoIn(there.winsIn) };
}

function sameSpan(
    span: Span,
    { file, offset, length }: Pick<Span, "file" | "offset" | "length">,
): boolean {
    return span.file === file && span.offset === offset && span.length === length;
}

function newSharedPlace(tokens: DesignTokens, path: string, place: string | undefined): NewPlace {
    const parent = parentOf(path);
    if (parent !== undefined) {
        if (inAny(tokens, (perm) => perm.token(parent))) {
            return refused({ kind: "not-a-group", path: parent });
        }
        if (!inAny(tokens, (perm) => perm.group(parent))) {
            return refused({ kind: "not-found", path: parent });
        }
    }
    const written = (at: string) =>
        tokens.writtenAt(at).filter((each) => each.sources.some(everyoneReads));
    if (written(path).length > 0) return refused({ kind: "taken", path });

    const files = unique(
        tokens.sources.filter((source) => everyoneReads(source) && !source.pointer),
    );
    if (files.length === 0) return refused({ kind: "no-shared-file", path });
    const parentSpans = parent === undefined ? [] : written(parent).map(({ span }) => span);
    const into = chosenFile(path, files, parentSpans, place);
    if (typeof into !== "string") return into;
    return { into, alsoAffects: seenReading(tokens, [into]) };
}

export function contextPlace(
    tokens: DesignTokens,
    path: string,
    chosen: Chosen,
    place: string | undefined,
): Placement {
    const { perm } = chosen;
    const written = perm.token(path);
    if (!written) return refused({ kind: "not-found", path });
    const refusal = refusalFor(written);
    if (refusal) return refusal;

    const winner = written.valueFrom;
    const winnerSpan = tokens.spanOf(winner);
    if (winner.source.context === chosen.context) {
        const there = tokens.writtenAt(path).find(({ span }) => span === winnerSpan);
        const at = memberAt(tokens, winnerSpan);
        if (!there || !at) return refused({ kind: "not-found", path });
        return { at, alsoAffects: alsoIn(there.winsIn, chosen) };
    }

    const parent = parentOf(path);
    const group = parent === undefined ? undefined : perm.group(parent);
    const groupSpans = (group?.writtenAt ?? []).map((each) => tokens.spanOf(each));
    const into = overrideFile(
        path,
        chosen,
        { source: winner.source, span: winnerSpan },
        groupSpans,
        place,
    );
    if (typeof into !== "string") return into;
    return { token: written, into, alsoAffects: seenReading(tokens, [into], chosen) };
}

function overrideFile(
    path: string,
    chosen: Chosen,
    winner: { source: Source; span: Span } | undefined,
    groupSpans: Span[],
    place: string | undefined,
): string | { choose: Choice } | { refused: Refusal } {
    const input = inputOf(chosen);
    const own = writable(chosen.perm, chosen);
    if (own.length === 0) return refused({ kind: "no-file-for-context", path, input });
    const winnerIndex = winner ? chosen.perm.sources.indexOf(winner.source) : -1;
    const later = own.filter(({ index }) => index > winnerIndex);
    if (later.length === 0 && winner) {
        return refused({ kind: "hidden-by-later-file", path, input, file: winner.span.file });
    }
    return chosenFile(path, unique(later), groupSpans, place);
}

function newContextPlace(
    tokens: DesignTokens,
    path: string,
    chosen: Chosen,
    place: string | undefined,
): NewPlace {
    const { perm } = chosen;
    const parent = parentOf(path);
    if (parent !== undefined && perm.token(parent)) {
        return refused({ kind: "not-a-group", path: parent });
    }
    const groupPlaces = parent === undefined ? [] : perm.group(parent)?.writtenAt;
    if (!groupPlaces) return refused({ kind: "not-found", path: parent ?? path });
    const existing = perm.token(path);
    if (existing && existing.valueFrom.source.context !== chosen.context) {
        return refused({ kind: "override-instead", path, input: inputOf(chosen) });
    }
    if (existing || perm.group(path)) return refused({ kind: "taken", path });

    const files = unique(writable(perm, chosen));
    if (files.length === 0) {
        return refused({ kind: "no-file-for-context", path, input: inputOf(chosen) });
    }
    const groupSpans = groupPlaces.map((each) => tokens.spanOf(each));
    const into = chosenFile(path, files, groupSpans, place);
    if (typeof into !== "string") return into;
    return { into, alsoAffects: seenReading(tokens, [into], chosen) };
}

export function chosenContext(
    tokens: DesignTokens,
    input: Input,
): Chosen | { refused: Refusal } | undefined {
    if (Object.keys(input).length === 0) return undefined;
    let perm: Permutation;
    try {
        perm = tokens.permutation(input);
    } catch (error) {
        if (!(error instanceof PermutationError)) throw error;
        return refused({ kind: "no-permutation", input, why: error.detail.reason });
    }
    const away = perm.contexts.filter((context) => !context.isDefault);
    const [context] = away;
    if (context === undefined) return undefined;
    if (away.length > 1) {
        const named = Object.fromEntries(away.map((each) => [each.modifier.name, each.name]));
        return refused({ kind: "several-contexts", input: named });
    }
    return { perm, context };
}

function writable(perm: Permutation, chosen: Chosen): { file: string; index: number }[] {
    return perm.sources.flatMap(({ context, pointer, file }, index) =>
        context === chosen.context && !pointer ? [{ file, index }] : [],
    );
}

function chosenFile(
    path: string,
    candidates: string[],
    groupSpans: Span[],
    place: string | undefined,
): string | { choose: Choice } {
    if (place !== undefined && candidates.includes(place)) return place;
    const declaring = candidates.filter((file) => groupSpans.some((span) => span.file === file));
    const pool = declaring.length > 0 ? declaring : candidates;
    const [only] = pool;
    if (only !== undefined && pool.length === 1) return only;
    return { choose: { path, files: pool } };
}

function everyoneReads({ readBy }: Source): boolean {
    return readBy === "everyone";
}

function inAny(tokens: DesignTokens, find: (perm: Permutation) => unknown): boolean {
    return tokens.permutations.some((perm) => find(perm) !== undefined);
}

function unique(sources: { file: string }[]): string[] {
    return [...new Set(sources.map(({ file }) => file))];
}

function inputOf({ context }: Chosen): Input {
    return { [context.modifier.name]: context.name };
}

function refusalFor(found: Token | Group): { refused: Refusal } | undefined {
    const { path, inherited } = found;
    const generated = "generated" in found ? found.generated : undefined;
    if (generated) return refused({ kind: "generated", path, ...generated });
    if (inherited) return refused({ kind: "inherited", path, from: inherited.from });
    return undefined;
}

export function seenReading(
    tokens: DesignTokens,
    files: readonly string[],
    chosen?: Chosen,
): Permutations {
    return alsoIn(
        tokens.permutations.where((perm) =>
            perm.sources.some((source) => files.includes(source.file)),
        ),
        chosen,
    );
}

function alsoIn(among: Permutations, chosen?: Chosen): Permutations {
    return among.where(
        (perm) => perm.contexts.length > 0 && (!chosen || !perm.contexts.includes(chosen.context)),
    );
}
