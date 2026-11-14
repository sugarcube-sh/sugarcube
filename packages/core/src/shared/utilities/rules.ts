import { type Token, type TokenType, tokenPath } from "@sugarcube-sh/dtcg";
import { toCSSIdentifier } from "@sugarcube-sh/dtcg/css";
import type { UtilityClassesConfig } from "../../types/config.js";
import type {
    AnyDiagnostic,
    UtilityEntry,
    UtilityWithoutClassesReason,
} from "../../types/diagnostics.js";
import { type TokenProblem, createTokenProblem, createDiagnostic } from "../diagnostics.js";
import type { UtilityClassConfig } from "../../types/utilities.js";
import type { UtilityToken } from "./tokens.js";

export type UtilityRule = [RegExp, (match: RegExpMatchArray) => Record<string, string> | undefined];

interface PrefixProperty {
    property: string;
    strip?: string;
    names: Map<string, string>;
}

export interface ClassPrefix {
    prefix: string;
    uses: PrefixProperty[];
}

interface TokenVariable {
    token: Token;
    name: string;
}

interface Skipped {
    type: TokenType;
    reason: "typography" | "type" | "private" | "unwritten";
}

interface Entry {
    location: UtilityEntry;
    source: string;
    parts: Map<string, [TokenVariable, ...TokenVariable[]]>;
    skipped: Skipped[];
}

interface EntryProperty extends PrefixProperty {
    entry: Entry;
}

interface ReadEntryResult {
    entry: Entry;
    uses: { prefix: string; use: EntryProperty }[];
    safelist: string[];
    diagnostics: AnyDiagnostic[];
}

interface ClassCandidate {
    variable: TokenVariable;
    property: string;
    entry: Entry;
    prefix: string;
}

interface Shadowing {
    prefixes: Set<string>;
    by: Set<Entry>;
    sameVariable: boolean;
}

const DIRECTIONS = [
    { direction: "x", letter: "x", logical: "inline" },
    { direction: "y", letter: "y", logical: "block" },
    { direction: "top", letter: "t", logical: "block-start" },
    { direction: "right", letter: "r", logical: "inline-end" },
    { direction: "bottom", letter: "b", logical: "block-end" },
    { direction: "left", letter: "l", logical: "inline-start" },
] as const;

const TOKEN_TYPES_BY_PROPERTY: Record<string, TokenType[]> = {
    "color": ["color"],
    "background-color": ["color"],
    "border-color": ["color"],
    "font-size": ["dimension"],
    "font-weight": ["fontWeight", "number"],
    "line-height": ["number", "dimension"],
    "border-radius": ["dimension"],
    "border-width": ["dimension"],
    "padding": ["dimension"],
    "margin": ["dimension"],
    "width": ["dimension"],
    "height": ["dimension"],
    "gap": ["dimension"],
    "font-family": ["fontFamily"],
    "transition-duration": ["duration"],
    "transition-timing-function": ["cubicBezier"],
    "border-style": ["strokeStyle"],
    "box-shadow": ["shadow"],
    "text-shadow": [],
    "background-image": ["gradient"],
    "opacity": ["number"],
};

/**
 * Makes the UnoCSS rules for the config's utility classes.
 *
 * A class is a prefix and a token's name under `source`, such as `bg-primary`.
 * When two tokens make the same class, the first in file order wins.
 *
 * @param tokens - The tokens from `getUtilityTokens`.
 * @param classes - The config's `utilities.classes`.
 *
 * @example
 * createUtilityRules(tokens, config.utilities.classes).prefixes.map(({ prefix }) => prefix)
 * // => ["bg", "px", "py"]
 */
export function createUtilityRules(
    tokens: UtilityToken[],
    classes: UtilityClassesConfig,
): {
    rules: UtilityRule[];
    prefixes: ClassPrefix[];
    safelist: string[];
    customProperties: string[];
    tokenProblems: TokenProblem[];
    diagnostics: AnyDiagnostic[];
} {
    const results = Object.entries(classes).flatMap(([property, entryConfig]) =>
        [entryConfig].flat().map((config, index) => {
            const location = Array.isArray(entryConfig) ? { property, entry: index } : { property };
            return readEntry(tokens, config, location);
        }),
    );
    const usesByPrefix = groupUsesByPrefix(results);
    const candidatesByClass = findClassCandidates(usesByPrefix);
    const shadowed = findShadowedEntries(candidatesByClass);
    const prefixes = [...usesByPrefix].map(([prefix, uses]) => ({
        prefix,
        uses: uses.map(({ property, strip, names }) => ({ property, strip, names })),
    }));
    const withoutClasses =
        tokens.length === 0
            ? []
            : results.flatMap(({ entry }) => findEntryWithoutClasses(entry, shadowed));

    return {
        rules: prefixes.map(createRule),
        prefixes,
        safelist: [...new Set(results.flatMap(({ safelist }) => safelist))],
        customProperties: getCustomProperties(candidatesByClass),
        tokenProblems: findSameClasses(candidatesByClass),
        diagnostics: [...withoutClasses, ...results.flatMap(({ diagnostics }) => diagnostics)],
    };
}

function readEntry(
    tokens: UtilityToken[],
    config: UtilityClassConfig,
    location: UtilityEntry,
): ReadEntryResult {
    const { property } = location;
    const { parts, skipped } = getParts(tokens, config, property);
    const entry: Entry = { location, source: config.source, parts, skipped };
    const variableLookup = {
        strip: getDuplicatePrefix(config),
        names: new Map([...parts].map(([part, [first]]) => [part, first.name])),
    };
    const { safelisted, unmatched } = matchSafelist(config.safelist, variableLookup, location);
    const prefixes = getClassPrefixes(config, property);

    return {
        entry,
        uses: prefixes.map(({ prefix, property: classProperty }) => ({
            prefix,
            use: { property: classProperty, ...variableLookup, entry },
        })),
        safelist: prefixes.flatMap(({ prefix }) => safelisted.map((part) => `${prefix}-${part}`)),
        diagnostics: [...findDeprecatedDirections(config, location), ...unmatched],
    };
}

function groupUsesByPrefix(results: ReadEntryResult[]): Map<string, EntryProperty[]> {
    const usesByPrefix = new Map<string, EntryProperty[]>();
    for (const { uses } of results) {
        for (const { prefix, use } of uses) {
            usesByPrefix.set(prefix, [...(usesByPrefix.get(prefix) ?? []), use]);
        }
    }
    return usesByPrefix;
}

function matchSafelist(
    safelist: UtilityClassConfig["safelist"],
    variableLookup: Omit<PrefixProperty, "property">,
    location: UtilityEntry,
): { safelisted: string[]; unmatched: AnyDiagnostic[] } {
    if (safelist === true) return { safelisted: [...variableLookup.names.keys()], unmatched: [] };
    const listed = Array.isArray(safelist) ? safelist : [];
    const hasToken = (part: string) => getVariableName(variableLookup, part) !== undefined;
    const unmatched =
        variableLookup.names.size === 0
            ? []
            : listed
                  .filter((part) => !hasToken(part))
                  .map((part) => createDiagnostic("safelist-without-token", { ...location, part }));
    return { safelisted: listed.filter(hasToken), unmatched };
}

function findDeprecatedDirections(
    config: UtilityClassConfig,
    location: UtilityEntry,
): AnyDiagnostic[] {
    if (![config.directions].flat().includes("full")) return [];
    return [createDiagnostic("option-deprecated", { option: 'directions: "full"', ...location })];
}

function getCustomProperties(
    candidatesByClass: Map<string, [ClassCandidate, ...ClassCandidate[]]>,
): string[] {
    const properties = [...candidatesByClass.values()].map(([{ property }]) => property);
    return [...new Set(properties.filter((property) => property.startsWith("--")))];
}

function createRule({ prefix, uses }: ClassPrefix): UtilityRule {
    return [
        new RegExp(`^${escapeRegExp(prefix)}-.+$`),
        (match) => {
            const part = match[0].slice(prefix.length + 1);
            for (const use of uses) {
                const name = getVariableName(use, part);
                if (name !== undefined) return { [use.property]: `var(${name})` };
            }
            return undefined;
        },
    ];
}

function getVariableName(
    { strip, names }: Omit<PrefixProperty, "property">,
    part: string,
): string | undefined {
    return names.get(stripDuplicatePrefix(part, strip));
}

function findClassCandidates(
    usesByPrefix: Map<string, EntryProperty[]>,
): Map<string, [ClassCandidate, ...ClassCandidate[]]> {
    const candidatesByClass = new Map<string, [ClassCandidate, ...ClassCandidate[]]>();
    for (const [prefix, uses] of usesByPrefix) {
        const prefixCandidates = new Map<string, [ClassCandidate, ...ClassCandidate[]]>();
        for (const { entry, property } of uses) {
            const toCandidate = (variable: TokenVariable): ClassCandidate => ({
                variable,
                property,
                entry,
                prefix,
            });
            for (const [part, [first, ...rest]] of entry.parts) {
                const className = `${prefix}-${part}`;
                const candidates: [ClassCandidate, ...ClassCandidate[]] = [
                    toCandidate(first),
                    ...rest.map(toCandidate),
                ];
                const existing = prefixCandidates.get(className);
                if (existing) existing.push(...candidates);
                else prefixCandidates.set(className, candidates);
            }
        }
        for (const [className, candidates] of prefixCandidates) {
            candidatesByClass.set(className, [
                ...candidates,
                ...(candidatesByClass.get(className) ?? []),
            ]);
        }
    }
    return candidatesByClass;
}

function findSameClasses(
    candidatesByClass: Map<string, [ClassCandidate, ...ClassCandidate[]]>,
): TokenProblem[] {
    const problems = new Map<string, TokenProblem>();
    for (const [className, [first, ...others]] of candidatesByClass) {
        for (const each of others) {
            const [used, other] = [first.variable, each.variable];
            const key = [used.token.path, other.token.path].sort().join("\u0000");
            if (sameVariable(first, each) || problems.has(key)) continue;
            const paths: [string, string] = [used.token.path, other.token.path];
            problems.set(
                key,
                createTokenProblem(other.token, "same-utility-class", { className, paths }),
            );
        }
    }
    return [...problems.values()];
}

function findEntryWithoutClasses(entry: Entry, shadowed: Map<Entry, Shadowing>): AnyDiagnostic[] {
    const reason =
        entry.parts.size === 0 ? getEmptyReason(entry) : toShadowedReason(shadowed.get(entry));
    if (reason === undefined) return [];
    return [
        createDiagnostic("utility-without-classes", {
            ...entry.location,
            source: entry.source,
            ...reason,
        }),
    ];
}

function getEmptyReason({
    location,
    source,
    skipped,
}: Entry): UtilityWithoutClassesReason | undefined {
    const expected = TOKEN_TYPES_BY_PROPERTY[location.property];
    const skippedFor = (...reasons: Skipped["reason"][]) =>
        skipped.filter((each) => reasons.includes(each.reason));
    if (skipped.length === 0) return { reason: "no-tokens", group: getGroupPath(source) };
    if (expected?.length === 0) return { reason: "no-type" };
    if (skippedFor("private").length > 0) return { reason: "private" };
    if (expected && skippedFor("type").length > 0) {
        const types = new Set(skippedFor("type", "typography").map(({ type }) => type));
        return { reason: "wrong-type", received: [...types], expected };
    }
    if (skippedFor("typography").length > 0) return { reason: "typography" };
    return undefined;
}

function findShadowedEntries(
    candidatesByClass: Map<string, [ClassCandidate, ...ClassCandidate[]]>,
): Map<Entry, Shadowing> {
    const used = new Set<Entry>();
    const shadowed = new Map<Entry, Shadowing>();
    for (const [first, ...others] of candidatesByClass.values()) {
        used.add(first.entry);
        for (const other of others) {
            if (sameVariable(first, other) && first.property === other.property) {
                used.add(other.entry);
                continue;
            }
            const shadowing = shadowed.get(other.entry) ?? {
                prefixes: new Set(),
                by: new Set(),
                sameVariable: false,
            };
            shadowing.prefixes.add(other.prefix);
            shadowing.by.add(first.entry);
            shadowing.sameVariable ||= sameVariable(first, other);
            shadowed.set(other.entry, shadowing);
        }
    }
    for (const entry of used) shadowed.delete(entry);
    return shadowed;
}

function toShadowedReason(
    shadowed: Shadowing | undefined,
): UtilityWithoutClassesReason | undefined {
    if (!shadowed?.sameVariable) return undefined;
    const by = [...shadowed.by].map(({ location }) => location);
    return { reason: "classes-taken", prefixes: [...shadowed.prefixes], by };
}

function sameVariable(first: ClassCandidate, other: ClassCandidate): boolean {
    return first.variable.name === other.variable.name;
}

function getParts(
    tokens: UtilityToken[],
    entry: UtilityClassConfig,
    property: string,
): { parts: Map<string, [TokenVariable, ...TokenVariable[]]>; skipped: Skipped[] } {
    const group = getGroupPath(entry.source);
    const types = TOKEN_TYPES_BY_PROPERTY[property];
    const parts = new Map<string, [TokenVariable, ...TokenVariable[]]>();
    const skipped: Skipped[] = [];
    for (const utilityToken of tokens) {
        const { token } = utilityToken;
        const relativePath = tokenPath.relative(group, tokenPath.removeRoot(token.path));
        if (relativePath === undefined) continue;
        const skip = (reason: Skipped["reason"]) => skipped.push({ type: token.type, reason });
        if ("variables" in utilityToken) skip("typography");
        else if (types && !types.includes(token.type)) skip("type");
        else if ("private" in utilityToken) skip(utilityToken.private ? "private" : "unwritten");
        else {
            const part = stripDuplicatePrefix(
                toCSSIdentifier(relativePath),
                getDuplicatePrefix(entry),
            );
            const existing = parts.get(part);
            if (existing) existing.push(utilityToken);
            else parts.set(part, [utilityToken]);
        }
    }
    return { parts, skipped };
}

function getGroupPath(source: string): string {
    return source.endsWith(".*") ? source.slice(0, -2) : source;
}

function getBasePrefix({ prefix, source }: UtilityClassConfig): string {
    const dot = source.indexOf(".");
    return prefix ?? (dot === -1 ? source : source.slice(0, dot));
}

function getDuplicatePrefix(entry: UtilityClassConfig): string | undefined {
    return entry.stripDuplicates ? getBasePrefix(entry) : undefined;
}

function stripDuplicatePrefix(part: string, strip: string | undefined): string {
    return strip !== undefined && part.startsWith(`${strip}-`)
        ? part.slice(strip.length + 1)
        : part;
}

function getClassPrefixes(
    entry: UtilityClassConfig,
    property: string,
): { prefix: string; property: string }[] {
    const basePrefix = getBasePrefix(entry);
    if (entry.directions === undefined) return [{ prefix: basePrefix, property }];
    const directions: string[] = [entry.directions].flat();
    const all = directions.includes("all");
    return [
        ...(all ? [{ prefix: basePrefix, property }] : []),
        ...DIRECTIONS.filter(({ direction }) => all || directions.includes(direction)).map(
            ({ letter, logical }) => ({
                prefix: `${basePrefix}${letter}`,
                property: `${property}-${logical}`,
            }),
        ),
    ];
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
