import type { Token, TokenType } from "@sugarcube-sh/dtcg";
import type { UtilityClassesConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import { diagnostic } from "../diagnostics.js";
import type { PropertyUtilityConfig } from "../../types/utilities.js";
import type { UtilityToken } from "./tokens.js";

export type UtilityRule = [RegExp, (match: RegExpMatchArray) => Record<string, string> | undefined];

interface Named {
    token: Token;
    name: string;
}

interface Use {
    property: string;
    parts: Map<string, [Named, ...Named[]]>;
    find: (part: string) => string | undefined;
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
    "font-weight": ["fontWeight"],
    "line-height": ["number"],
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
    "text-shadow": ["shadow"],
    "background-image": ["gradient"],
    "opacity": ["number"],
};

/**
 * The UnoCSS rules for the config's utility classes, and the classes the config asks to be
 * written whether or not markup uses them. A class is a start (the entry's `prefix`, or the first
 * segment of its `source`, with a direction's letter) and a part (the token's path below
 * `source`, joined with dashes, a final `$root` dropped), and writes that token's variable. Rules
 * come in the config's order, each shorthand before its longhands; entries sharing a start are
 * tried in the config's order, and among tokens making the same class the first in file order is
 * used. A class two tokens with different variables make is reported, on the token not used.
 */
export function utilityRules(
    tokens: UtilityToken[],
    classes: UtilityClassesConfig,
): { rules: UtilityRule[]; safelist: string[]; diagnostics: Reported[] } {
    const byStart = new Map<string, Use[]>();
    const safelist = new Set<string>();
    for (const [property, listed] of Object.entries(classes)) {
        for (const entry of [listed].flat()) {
            const parts = partsFor(tokens, entry, property);
            const find = (part: string) => parts.get(stripped(part, entry))?.[0].name;
            const forced = Array.isArray(entry.safelist)
                ? entry.safelist.filter((part) => find(part) !== undefined)
                : entry.safelist
                  ? [...parts.keys()]
                  : [];
            for (const { start, property: written } of startsFor(entry, property)) {
                const use = { property: written, parts, find };
                byStart.set(start, [...(byStart.get(start) ?? []), use]);
                for (const part of forced) safelist.add(`${start}-${part}`);
            }
        }
    }
    return {
        rules: [...byStart].map(([start, uses]) => [
            new RegExp(`^${escaped(start)}-.+$`),
            (match) => {
                const part = match[0].slice(start.length + 1);
                for (const { property, find } of uses) {
                    const name = find(part);
                    if (name !== undefined) return { [property]: `var(${name})` };
                }
                return undefined;
            },
        ]),
        safelist: [...safelist],
        diagnostics: sameClasses(byStart),
    };
}

function sameClasses(byStart: Map<string, Use[]>): Reported[] {
    const found = new Map<string, Reported>();
    const report = (className: string, used: Named, other: Named) => {
        const key = [used.token.path, other.token.path].sort().join("\u0000");
        if (used.name === other.name || found.has(key)) return;
        const paths: [string, string] = [used.token.path, other.token.path];
        found.set(key, diagnostic("same-utility-class", { className, paths }, other.token));
    };
    const answered = new Map<string, Named>();
    for (const [start, uses] of byStart) {
        const own = new Map<string, Named>();
        for (const { parts } of uses) {
            for (const [part, named] of parts) {
                for (const each of named) {
                    const className = `${start}-${part}`;
                    const first = own.get(className);
                    if (first) report(className, first, each);
                    else own.set(className, each);
                }
            }
        }
        for (const [className, each] of own) {
            const earlier = answered.get(className);
            if (earlier) report(className, each, earlier);
            answered.set(className, each);
        }
    }
    return [...found.values()];
}

function partsFor(
    tokens: UtilityToken[],
    entry: PropertyUtilityConfig,
    property: string,
): Map<string, [Named, ...Named[]]> {
    const base = entry.source.endsWith(".*") ? entry.source.slice(0, -2) : entry.source;
    const types = TYPES[property];
    const parts = new Map<string, [Named, ...Named[]]>();
    for (const listed of tokens) {
        if (!("name" in listed)) continue;
        const { token } = listed;
        if (!token.path.startsWith(`${base}.`)) continue;
        if (types && !types.includes(token.type)) continue;
        const segments = token.path.slice(base.length + 1).split(".");
        if (segments.at(-1) === "$root") segments.pop();
        if (segments.length === 0) continue;
        const part = stripped(segments.join("-"), entry);
        const earlier = parts.get(part);
        if (earlier) earlier.push(listed);
        else parts.set(part, [listed]);
    }
    return parts;
}

function stripped(part: string, { prefix, stripDuplicates }: PropertyUtilityConfig): string {
    return stripDuplicates && prefix && part.startsWith(`${prefix}-`)
        ? part.slice(prefix.length + 1)
        : part;
}

function startsFor(
    entry: PropertyUtilityConfig,
    property: string,
): { start: string; property: string }[] {
    const dot = entry.source.indexOf(".");
    const prefix = entry.prefix ?? (dot === -1 ? entry.source : entry.source.slice(0, dot));
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
