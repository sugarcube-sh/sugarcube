import { type Token, type TokenType, pathBelow, withoutRoot } from "@sugarcube-sh/dtcg";
import { cssName } from "@sugarcube-sh/dtcg/css";
import type { UtilityClassesConfig } from "../../types/config.js";
import type {
    Reported,
    UtilityEntry,
    UtilityWithoutClassesReason,
} from "../../types/diagnostics.js";
import { diagnostic } from "../diagnostics.js";
import type { PropertyUtilityConfig } from "../../types/utilities.js";
import type { UtilityToken } from "./tokens.js";

export type UtilityRule = [RegExp, (match: RegExpMatchArray) => Record<string, string> | undefined];

interface UtilityUse {
    property: string;
    strip?: string;
    names: Map<string, string>;
}

export interface UtilityStart {
    start: string;
    uses: UtilityUse[];
}

interface Named {
    token: Token;
    name: string;
}

interface Skipped {
    type: TokenType;
    why: "typography" | "type" | "private" | "unwritten";
}

interface Entry {
    about: UtilityEntry;
    source: string;
    parts: Map<string, [Named, ...Named[]]>;
    skipped: Skipped[];
}

interface Use extends UtilityUse {
    entry: Entry;
}

interface Answer {
    named: Named;
    property: string;
    entry: Entry;
    start: string;
}

interface Lost {
    starts: Set<string>;
    by: Set<Entry>;
    silent: boolean;
}

const SIDES = [
    { direction: "x", letter: "x", logical: "inline" },
    { direction: "y", letter: "y", logical: "block" },
    { direction: "top", letter: "t", logical: "block-start" },
    { direction: "right", letter: "r", logical: "inline-end" },
    { direction: "bottom", letter: "b", logical: "block-end" },
    { direction: "left", letter: "l", logical: "inline-start" },
] as const;

const TYPES: Record<string, TokenType[]> = {
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
 * The UnoCSS rules for the config's utility classes, the same rules as data (`starts`, equal for
 * two reads that make the same classes), and the classes the config asks to be written whether or
 * not markup uses them. A class is a start (the entry's `prefix`, or the first segment of its
 * `source`, with a direction's letter) and a part (the {@link cssName} of the token's path below
 * `source`, as its variable has it), and writes that token's variable. Rules come in the config's
 * order, each shorthand before its longhands; entries sharing a start are tried in the config's
 * order, and among tokens making the same class the first in file order is used. A class two
 * tokens with different variables make is reported, on the token not used; so is an entry that
 * makes no classes, with the reason, and a part its `safelist` names that no token under `source`
 * makes.
 */
export function utilityRules(
    tokens: UtilityToken[],
    classes: UtilityClassesConfig,
): {
    rules: UtilityRule[];
    starts: UtilityStart[];
    safelist: string[];
    diagnostics: Reported[];
} {
    const byStart = new Map<string, Use[]>();
    const entries: Entry[] = [];
    const safelist = new Set<string>();
    const unmatched: Reported[] = [];
    for (const [property, listed] of Object.entries(classes)) {
        const several = Array.isArray(listed);
        for (const [index, config] of [listed].flat().entries()) {
            const { parts, skipped } = partsFor(tokens, config, property);
            const starts = startsFor(config, property);
            const about = several ? { property, entry: index } : { property };
            if ([config.directions].flat().includes("full")) {
                const option = 'directions: "full"';
                unmatched.push(diagnostic("option-deprecated", { option, ...about }));
            }
            const entry = { about, source: config.source, parts, skipped };
            entries.push(entry);
            const strip = stripOf(config);
            const names = new Map([...parts].map(([part, [first]]) => [part, first.name]));
            const find = (part: string) => names.get(stripped(part, strip));
            const forced = config.safelist === true ? [...parts.keys()] : [];
            for (const part of Array.isArray(config.safelist) ? config.safelist : []) {
                if (find(part) !== undefined) forced.push(part);
                else if (parts.size > 0) {
                    unmatched.push(diagnostic("safelist-without-token", { ...about, part }));
                }
            }
            for (const { start, property: written } of starts) {
                byStart.set(start, [
                    ...(byStart.get(start) ?? []),
                    { property: written, strip, names, entry },
                ]);
                for (const part of forced) safelist.add(`${start}-${part}`);
            }
        }
    }
    const answered = answers(byStart);
    const lost = lostBy(answered);
    const starts = [...byStart].map(([start, uses]) => ({
        start,
        uses: uses.map(({ property, strip, names }) => ({ property, strip, names })),
    }));
    return {
        rules: starts.map(ruleFor),
        starts,
        safelist: [...safelist],
        diagnostics: [
            ...sameClasses(answered),
            ...entries.flatMap((entry) => withoutClasses(entry, lost)),
            ...unmatched,
        ],
    };
}

function ruleFor({ start, uses }: UtilityStart): UtilityRule {
    return [
        new RegExp(`^${escaped(start)}-.+$`),
        (match) => {
            const part = match[0].slice(start.length + 1);
            for (const { property, strip, names } of uses) {
                const name = names.get(stripped(part, strip));
                if (name !== undefined) return { [property]: `var(${name})` };
            }
            return undefined;
        },
    ];
}

function answers(byStart: Map<string, Use[]>): Map<string, [Answer, ...Answer[]]> {
    const answered = new Map<string, [Answer, ...Answer[]]>();
    for (const [start, uses] of byStart) {
        const own = new Map<string, [Answer, ...Answer[]]>();
        for (const { entry, property } of uses) {
            const answer = (named: Named): Answer => ({ named, property, entry, start });
            for (const [part, [first, ...rest]] of entry.parts) {
                const className = `${start}-${part}`;
                const found: [Answer, ...Answer[]] = [answer(first), ...rest.map(answer)];
                const earlier = own.get(className);
                if (earlier) earlier.push(...found);
                else own.set(className, found);
            }
        }
        for (const [className, found] of own) {
            answered.set(className, [...found, ...(answered.get(className) ?? [])]);
        }
    }
    return answered;
}

function sameClasses(answered: Map<string, [Answer, ...Answer[]]>): Reported[] {
    const found = new Map<string, Reported>();
    for (const [className, [first, ...others]] of answered) {
        for (const each of others) {
            const [used, other] = [first.named, each.named];
            const key = [used.token.path, other.token.path].sort().join("\u0000");
            if (sameVariable(first, each) || found.has(key)) continue;
            const paths: [string, string] = [used.token.path, other.token.path];
            found.set(key, diagnostic("same-utility-class", { className, paths }, other.token));
        }
    }
    return [...found.values()];
}

function withoutClasses(entry: Entry, lost: Map<Entry, Lost>): Reported[] {
    const why = entry.parts.size === 0 ? emptied(entry) : answeredFirst(lost.get(entry));
    if (why === undefined) return [];
    return [
        diagnostic("utility-without-classes", { ...entry.about, source: entry.source, ...why }),
    ];
}

function emptied({ about, source, skipped }: Entry): UtilityWithoutClassesReason | undefined {
    const takes = TYPES[about.property];
    const found = (...why: Skipped["why"][]) => skipped.filter((each) => why.includes(each.why));
    if (skipped.length === 0) return { reason: "no-tokens", group: groupOf(source) };
    if (takes?.length === 0) return { reason: "no-type" };
    if (found("private").length > 0) return { reason: "private" };
    if (takes && found("type").length > 0) {
        const types = new Set(found("type", "typography").map(({ type }) => type));
        return { reason: "wrong-type", found: [...types], takes };
    }
    if (found("typography").length > 0) return { reason: "typography" };
    return undefined;
}

function lostBy(answered: Map<string, [Answer, ...Answer[]]>): Map<Entry, Lost> {
    const made = new Set<Entry>();
    const lost = new Map<Entry, Lost>();
    for (const [first, ...others] of answered.values()) {
        made.add(first.entry);
        for (const other of others) {
            if (sameVariable(first, other) && first.property === other.property) {
                made.add(other.entry);
                continue;
            }
            const found = lost.get(other.entry) ?? {
                starts: new Set(),
                by: new Set(),
                silent: false,
            };
            found.starts.add(other.start);
            found.by.add(first.entry);
            found.silent ||= sameVariable(first, other);
            lost.set(other.entry, found);
        }
    }
    for (const entry of made) lost.delete(entry);
    return lost;
}

function answeredFirst(lost: Lost | undefined): UtilityWithoutClassesReason | undefined {
    if (!lost?.silent) return undefined;
    const by = [...lost.by].map(({ about }) => about);
    return { reason: "answered-first", starts: [...lost.starts], by };
}

function sameVariable(first: Answer, other: Answer): boolean {
    return first.named.name === other.named.name;
}

function partsFor(
    tokens: UtilityToken[],
    entry: PropertyUtilityConfig,
    property: string,
): { parts: Map<string, [Named, ...Named[]]>; skipped: Skipped[] } {
    const group = groupOf(entry.source);
    const types = TYPES[property];
    const parts = new Map<string, [Named, ...Named[]]>();
    const skipped: Skipped[] = [];
    for (const listed of tokens) {
        const { token } = listed;
        const below = pathBelow(withoutRoot(token.path), group);
        if (below === undefined) continue;
        const skip = (why: Skipped["why"]) => skipped.push({ type: token.type, why });
        if ("variables" in listed) skip("typography");
        else if (types && !types.includes(token.type)) skip("type");
        else if ("private" in listed) skip(listed.private ? "private" : "unwritten");
        else {
            const part = stripped(cssName(below), stripOf(entry));
            const earlier = parts.get(part);
            if (earlier) earlier.push(listed);
            else parts.set(part, [listed]);
        }
    }
    return { parts, skipped };
}

function groupOf(source: string): string {
    return source.endsWith(".*") ? source.slice(0, -2) : source;
}

function prefixOf({ prefix, source }: PropertyUtilityConfig): string {
    const dot = source.indexOf(".");
    return prefix ?? (dot === -1 ? source : source.slice(0, dot));
}

function stripOf(entry: PropertyUtilityConfig): string | undefined {
    return entry.stripDuplicates ? prefixOf(entry) : undefined;
}

function stripped(part: string, strip: string | undefined): string {
    return strip !== undefined && part.startsWith(`${strip}-`)
        ? part.slice(strip.length + 1)
        : part;
}

function startsFor(
    entry: PropertyUtilityConfig,
    property: string,
): { start: string; property: string }[] {
    const prefix = prefixOf(entry);
    if (entry.directions === undefined) return [{ start: prefix, property }];
    const directions: string[] = [entry.directions].flat();
    const all = directions.includes("all");
    return [
        ...(all ? [{ start: prefix, property }] : []),
        ...SIDES.filter(({ direction }) => all || directions.includes(direction)).map(
            ({ letter, logical }) => ({
                start: `${prefix}${letter}`,
                property: `${property}-${logical}`,
            }),
        ),
    ];
}

function escaped(start: string): string {
    return start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
