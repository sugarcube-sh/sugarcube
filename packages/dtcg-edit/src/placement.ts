import {
    type DesignTokens,
    type Group,
    type Input,
    type JsonValue,
    type Permutation,
    PermutationError,
    type Permutations,
    type Definition,
    type ResolverContext,
    type Source,
    type Span,
    type Token,
    tokenPath,
} from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import { refuse } from "./error-messages.js";
import type { OpResult, PlaceOptions, Question, Refusal, Where } from "./index.js";
import { type Member, toMember } from "./file-text.js";
import { getJsonAt, getSpan } from "@sugarcube-sh/dtcg/editor";

interface FileChoice {
    path: string;
    files: readonly string[];
}

export function createQuestion(
    { path, files }: FileChoice,
    answer: (file: string) => OpResult,
): {
    question: Question;
} {
    return { question: { kind: "placement", path, files, answer } };
}

type Placement =
    | { at: Member; alsoAffects: Permutations }
    | { token: Token; into: string; alsoAffects: Permutations }
    | { choice: FileChoice }
    | { refused: Refusal };

type NewPlacement =
    | { into: string; alsoAffects: Permutations }
    | { choice: FileChoice }
    | { refused: Refusal };

interface DefinitionMember extends Member {
    permutationCount: number;
}

type DefinitionMembers =
    | { kind: "token" | "group"; members: DefinitionMember[]; alsoAffects: Permutations }
    | { refused: Refusal };

interface InputContext {
    permutation: Permutation;
    context: ResolverContext;
}

export function findPlacement(
    tokens: DesignTokens,
    path: string,
    options: PlaceOptions,
    chosenFile?: string,
): Placement {
    if (options.at) return findDefinitionPlacement(tokens, path, options.at);
    const chosen = getInputContext(tokens, options.input ?? {});
    if (chosen === undefined) return findSharedPlacement(tokens, path);
    if ("refused" in chosen) return chosen;
    return findContextPlacement(tokens, path, chosen, chosenFile);
}

export function findNewPlacement(
    tokens: DesignTokens,
    path: string,
    where: Where = {},
    chosenFile?: string,
): NewPlacement {
    const chosen = getInputContext(tokens, where.input ?? {});
    if (chosen && "refused" in chosen) return chosen;
    return chosen
        ? findNewContextPlacement(tokens, path, chosen, chosenFile)
        : findNewSharedPlacement(tokens, path, chosenFile);
}

export function getDefinitionMembers(tokens: DesignTokens, path: string): DefinitionMembers {
    const editable = findEditable(tokens, path, (perm) => perm.getTokenOrGroup(path));
    if ("refused" in editable) return editable;
    const places = tokens.getDefinitions(path).map(({ span, jsonPath, json, permutations }) => ({
        span,
        jsonPath,
        json,
        permutationCount: permutations.length,
    }));
    const alsoAffects = selectOtherPermutations(
        tokens.permutations.select((perm) => perm.getTokenOrGroup(path) !== undefined),
    );
    return { kind: editable.of, members: places, alsoAffects };
}

export function findPropertyPlacement(
    tokens: DesignTokens,
    path: string,
    key: string,
    places: DefinitionMember[],
    chosenFile: string | undefined,
): { at: Member; alsoAffects: Permutations } | { choice: FileChoice } | { refused: Refusal } {
    const hasKey = (member: Member) =>
        getJsonAt(tokens, member.span.file, [...member.jsonPath, key]) !== undefined;
    const keyMember = places.find(hasKey);
    if (keyMember)
        return {
            at: keyMember,
            alsoAffects: findAffectedPermutations(tokens, [keyMember.span.file]),
        };
    return findWidestPlacement(tokens, path, places, chosenFile);
}

function findWidestPlacement(
    tokens: DesignTokens,
    path: string,
    places: DefinitionMember[],
    chosenFile: string | undefined,
): { at: Member; alsoAffects: Permutations } | { choice: FileChoice } | { refused: Refusal } {
    const maxCount = Math.max(...places.map(({ permutationCount }) => permutationCount));
    const widest = places.filter(({ permutationCount }) => permutationCount === maxCount);
    const file = chooseFile(path, getUniqueFiles(widest.map(({ span }) => span)), [], chosenFile);
    if (typeof file !== "string") return file;
    const at = widest.find(({ span }) => span.file === file);
    if (!at) return refuse({ kind: "not-found", path });
    return { at, alsoAffects: findAffectedPermutations(tokens, [file]) };
}

export function getOwnProperties(token: Token): Record<string, JsonValue> {
    const own = token.winningDefinition.json;
    return isJsonObject(own) ? (own as Record<string, JsonValue>) : {};
}

type ExtensionPlacement =
    | { at: Member; currentExtension?: JsonValue; alsoAffects: Permutations }
    | { into: string; currentExtension: JsonValue | undefined; alsoAffects: Permutations }
    | { choice: FileChoice }
    | { refused: Refusal };

export function findExtensionPlacement(
    tokens: DesignTokens,
    path: string,
    key: string,
    where: PlaceOptions,
    chosenFile?: string,
): ExtensionPlacement {
    const copies = getDefinitionMembers(tokens, path);
    if ("refused" in copies) return copies;
    if (where.at) {
        const at = copies.members.find(({ span }) => sameSpan(span, where.at));
        if (!at) return refuse({ kind: "not-written-there", path, at: where.at });
        return { at, alsoAffects: findAffectedPermutations(tokens, [at.span.file]) };
    }
    const chosen = getInputContext(tokens, where.input ?? {});
    if (chosen && "refused" in chosen) return chosen;
    return chosen
        ? findContextExtensionPlacement(tokens, path, key, chosen, chosenFile)
        : findSharedExtensionPlacement(tokens, path, key, copies.members, chosenFile);
}

function findExtendedDefinition(group: Group | undefined, key: string): Definition | undefined {
    for (let from = group?.extends; from; from = from.extends) {
        const definition = from.extensionDefinitions[key];
        if (definition) return definition;
    }
    return undefined;
}

function getExtension(json: JsonValue | undefined, key: string): JsonValue | undefined {
    const extensions = isJsonObject(json) ? json.$extensions : undefined;
    return isJsonObject(extensions) ? extensions[key] : undefined;
}

function findSharedExtensionPlacement(
    tokens: DesignTokens,
    path: string,
    key: string,
    copies: DefinitionMember[],
    chosenFile: string | undefined,
): ExtensionPlacement {
    const getOwnDefinition = (perm: Permutation) => perm.getGroup(path)?.extensionDefinitions[key];
    const ownDefinitions = tokens.permutations.flatMap((perm) => getOwnDefinition(perm) ?? []);
    if (ownDefinitions.length > 0) {
        const shared = ownDefinitions.find(({ source }) => isReadByEveryContext(source));
        if (!shared) return refuse({ kind: "no-shared-value", path });
        return {
            at: toMember(tokens, shared),
            alsoAffects: selectOtherPermutations(
                tokens.permutations.select((perm) => getOwnDefinition(perm) === shared),
            ),
        };
    }
    const inheritedDefinitions = tokens.permutations.flatMap(
        (perm) => findExtendedDefinition(perm.getGroup(path), key) ?? [],
    );
    if (inheritedDefinitions.length === 0)
        return findWidestPlacement(tokens, path, copies, chosenFile);
    const [shared] = inheritedDefinitions;
    const isSame = inheritedDefinitions.every((each) => each === shared);
    if (!shared || !isSame || !isReadByEveryContext(shared.source)) {
        return refuse({ kind: "no-shared-value", path });
    }
    const placement = findWidestPlacement(tokens, path, copies, chosenFile);
    return "at" in placement
        ? { ...placement, currentExtension: getExtension(shared.json, key) }
        : placement;
}

function findContextExtensionPlacement(
    tokens: DesignTokens,
    path: string,
    key: string,
    chosen: InputContext,
    chosenFile: string | undefined,
): ExtensionPlacement {
    const { permutation: perm } = chosen;
    const group = perm.getGroup(path);
    if (!group) return refuse({ kind: "not-found", path });
    const winner = group.extensionDefinitions[key];
    const winnerSpan = winner && getSpan(tokens, winner);
    if (winner && winnerSpan && isContextSource(chosen, winner.source)) {
        const at = toMember(tokens, winner);
        return { at, alsoAffects: findAffectedPermutations(tokens, [winnerSpan.file], chosen) };
    }
    const groupSpans = group.definitions.map((each) => getSpan(tokens, each));
    const winnerLocation = winner && winnerSpan && { source: winner.source, span: winnerSpan };
    const into = chooseOverrideFile(path, chosen, winnerLocation, groupSpans, chosenFile);
    if (typeof into !== "string") return into;
    const currentExtension = getExtension(
        (winner ?? findExtendedDefinition(group, key))?.json,
        key,
    );
    return {
        into,
        currentExtension,
        alsoAffects: findAffectedPermutations(tokens, [into], chosen),
    };
}

function findEditable(
    tokens: DesignTokens,
    path: string,
    get: (perm: Permutation) => Token | Group | undefined,
): { of: "token" | "group" } | { refused: Refusal } {
    const tokensOrGroups = tokens.permutations.flatMap((perm) => get(perm) ?? []);
    if (tokensOrGroups.length === 0) return refuse({ kind: "not-found", path });
    for (const each of tokensOrGroups) {
        const refusal = findRefusal(each);
        if (refusal) return refusal;
    }
    return { of: tokensOrGroups.some(({ kind }) => kind === "token") ? "token" : "group" };
}

function findSharedPlacement(tokens: DesignTokens, path: string): Placement {
    const editable = findEditable(tokens, path, (perm) => perm.getToken(path));
    if ("refused" in editable) return editable;
    const shared = tokens
        .getDefinitions(path)
        .findLast((definition) => definition.sources.some(isReadByEveryContext));
    if (!shared) return refuse({ kind: "no-shared-value", path });
    return { at: shared, alsoAffects: selectOtherPermutations(shared.winningPermutations) };
}

function findDefinitionPlacement(
    tokens: DesignTokens,
    path: string,
    at: Pick<Span, "file" | "offset" | "length">,
): Placement {
    const editable = findEditable(tokens, path, (perm) => perm.getToken(path));
    if ("refused" in editable) return editable;
    const definition = tokens.getDefinitions(path).find(({ span }) => sameSpan(span, at));
    if (!definition) return refuse({ kind: "not-written-there", path, at });
    return { at: definition, alsoAffects: selectOtherPermutations(definition.winningPermutations) };
}

function sameSpan(
    span: Span,
    { file, offset, length }: Pick<Span, "file" | "offset" | "length">,
): boolean {
    return span.file === file && span.offset === offset && span.length === length;
}

function findNewSharedPlacement(
    tokens: DesignTokens,
    path: string,
    chosenFile: string | undefined,
): NewPlacement {
    const parent = tokenPath.getParent(path);
    if (parent !== undefined) {
        if (isInAnyPermutation(tokens, (perm) => perm.getToken(parent))) {
            return refuse({ kind: "not-a-group", path: parent });
        }
        if (!isInAnyPermutation(tokens, (perm) => perm.getGroup(parent))) {
            return refuse({ kind: "not-found", path: parent });
        }
    }
    const getSharedDefinitions = (at: string) =>
        tokens.getDefinitions(at).filter((each) => each.sources.some(isReadByEveryContext));
    if (getSharedDefinitions(path).length > 0) return refuse({ kind: "taken", path });

    const files = getUniqueFiles(
        tokens.sources.filter((source) => isReadByEveryContext(source) && !source.pointer),
    );
    if (files.length === 0) return refuse({ kind: "no-shared-file", path });
    const parentSpans =
        parent === undefined ? [] : getSharedDefinitions(parent).map(({ span }) => span);
    const into = chooseFile(path, files, parentSpans, chosenFile);
    if (typeof into !== "string") return into;
    return { into, alsoAffects: findAffectedPermutations(tokens, [into]) };
}

export function findContextPlacement(
    tokens: DesignTokens,
    path: string,
    chosen: InputContext,
    chosenFile: string | undefined,
): Placement {
    const { permutation: perm } = chosen;
    const token = perm.getToken(path);
    if (!token) return refuse({ kind: "not-found", path });
    const refusal = findRefusal(token);
    if (refusal) return refusal;

    const winner = token.winningDefinition;
    const winnerSpan = getSpan(tokens, winner);
    if (isContextSource(chosen, winner.source)) {
        const definition = tokens.getDefinitions(path).find(({ span }) => span === winnerSpan);
        if (!definition) return refuse({ kind: "not-found", path });
        return {
            at: toMember(tokens, winner),
            alsoAffects: selectOtherPermutations(definition.winningPermutations, chosen),
        };
    }

    const parent = tokenPath.getParent(path);
    const group = parent === undefined ? undefined : perm.getGroup(parent);
    const groupSpans = (group?.definitions ?? []).map((each) => getSpan(tokens, each));
    const into = chooseOverrideFile(
        path,
        chosen,
        { source: winner.source, span: winnerSpan },
        groupSpans,
        chosenFile,
    );
    if (typeof into !== "string") return into;
    return { token: token, into, alsoAffects: findAffectedPermutations(tokens, [into], chosen) };
}

function chooseOverrideFile(
    path: string,
    chosen: InputContext,
    winner: { source: Source; span: Span } | undefined,
    groupSpans: Span[],
    chosenFile: string | undefined,
): string | { choice: FileChoice } | { refused: Refusal } {
    const input = toInput(chosen);
    const contextFiles = getContextFiles(chosen.permutation, chosen);
    if (contextFiles.length === 0) return refuse({ kind: "no-file-for-context", path, input });
    const winnerIndex = winner ? chosen.permutation.sources.indexOf(winner.source) : -1;
    const laterFiles = contextFiles.filter(({ index }) => index > winnerIndex);
    if (laterFiles.length === 0 && winner) {
        return refuse({ kind: "hidden-by-later-file", path, input, file: winner.span.file });
    }
    return chooseFile(path, getUniqueFiles(laterFiles), groupSpans, chosenFile);
}

function findNewContextPlacement(
    tokens: DesignTokens,
    path: string,
    chosen: InputContext,
    chosenFile: string | undefined,
): NewPlacement {
    const { permutation: perm } = chosen;
    const parent = tokenPath.getParent(path);
    if (parent !== undefined && perm.getToken(parent)) {
        return refuse({ kind: "not-a-group", path: parent });
    }
    const groupDefinitions = parent === undefined ? [] : perm.getGroup(parent)?.definitions;
    if (!groupDefinitions) return refuse({ kind: "not-found", path: parent ?? path });
    const existing = perm.getToken(path);
    if (existing && !isContextSource(chosen, existing.winningDefinition.source)) {
        return refuse({ kind: "override-instead", path, input: toInput(chosen) });
    }
    if (existing || perm.getGroup(path)) return refuse({ kind: "taken", path });

    const files = getUniqueFiles(getContextFiles(perm, chosen));
    if (files.length === 0) {
        return refuse({ kind: "no-file-for-context", path, input: toInput(chosen) });
    }
    const groupSpans = groupDefinitions.map((each) => getSpan(tokens, each));
    const into = chooseFile(path, files, groupSpans, chosenFile);
    if (typeof into !== "string") return into;
    return { into, alsoAffects: findAffectedPermutations(tokens, [into], chosen) };
}

export function getInputContext(
    tokens: DesignTokens,
    input: Input,
): InputContext | { refused: Refusal } | undefined {
    if (Object.keys(input).length === 0) return undefined;
    let perm: Permutation;
    try {
        perm = tokens.getPermutation(input);
    } catch (error) {
        if (!(error instanceof PermutationError)) throw error;
        return refuse({ kind: "no-permutation", input, why: error.detail.reason });
    }
    const nonDefault = perm.contexts.filter((context) => !context.isDefault);
    const [context] = nonDefault;
    if (context === undefined) return undefined;
    if (nonDefault.length > 1) {
        const nonDefaultInput = Object.fromEntries(
            nonDefault.map((each) => [each.modifier.name, each.name]),
        );
        return refuse({ kind: "several-contexts", input: nonDefaultInput });
    }
    return { permutation: perm, context };
}

function getContextFiles(
    perm: Permutation,
    chosen: InputContext,
): { file: string; index: number }[] {
    return perm.sources.flatMap((source, index) =>
        isContextSource(chosen, source) && !source.pointer ? [{ file: source.file, index }] : [],
    );
}

function isContextSource({ context }: InputContext, { modifier }: Source): boolean {
    return modifier === context.modifier;
}

function chooseFile(
    path: string,
    candidates: string[],
    groupSpans: Span[],
    chosenFile: string | undefined,
): string | { choice: FileChoice } {
    if (chosenFile !== undefined && candidates.includes(chosenFile)) return chosenFile;
    const groupFiles = candidates.filter((file) => groupSpans.some((span) => span.file === file));
    const pool = groupFiles.length > 0 ? groupFiles : candidates;
    const [only] = pool;
    if (only !== undefined && pool.length === 1) return only;
    return { choice: { path, files: pool } };
}

function isReadByEveryContext({ contexts }: Source): boolean {
    return contexts === "every-context";
}

function isInAnyPermutation(tokens: DesignTokens, get: (perm: Permutation) => unknown): boolean {
    return tokens.permutations.some((perm) => get(perm) !== undefined);
}

function getUniqueFiles(sources: { file: string }[]): string[] {
    return [...new Set(sources.map(({ file }) => file))];
}

function toInput({ context }: InputContext): Input {
    return { [context.modifier.name]: context.name };
}

function findRefusal(tokenOrGroup: Token | Group): { refused: Refusal } | undefined {
    const { path, inherited } = tokenOrGroup;
    const generated = "generated" in tokenOrGroup ? tokenOrGroup.generated : undefined;
    if (generated) return refuse({ kind: "generated", path, ...generated });
    if (inherited) return refuse({ kind: "inherited", path, from: inherited.from });
    return undefined;
}

export function findAffectedPermutations(
    tokens: DesignTokens,
    files: readonly string[],
    chosen?: InputContext,
): Permutations {
    return selectOtherPermutations(
        tokens.permutations.select((perm) =>
            perm.sources.some((source) => files.includes(source.file)),
        ),
        chosen,
    );
}

function selectOtherPermutations(permutations: Permutations, chosen?: InputContext): Permutations {
    return permutations.select(
        (perm) => perm.contexts.length > 0 && (!chosen || !perm.contexts.includes(chosen.context)),
    );
}
