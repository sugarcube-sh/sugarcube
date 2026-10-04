import type { TokenType } from "@sugarcube-sh/dtcg";
import type { UtilityClassesConfig } from "../../types/config.js";
import type { PropertyUtilityConfig } from "../../types/utilities.js";
import type { UtilityToken } from "./tokens.js";

export type UtilityRule = [RegExp, (match: RegExpMatchArray) => Record<string, string> | undefined];

interface Use {
    property: string;
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
 * written whether or not markup uses them. A class is a start (the entry's `prefix`, or the first segment
 * of its `source`, with a direction's letter) and a part (the token's path below `source`, joined
 * with dashes), and writes that token's variable. Rules come in the config's order, each
 * shorthand before its longhands; entries sharing a start are tried in the config's order, and
 * among tokens making the same class the first in file order is used.
 */
export function utilityRules(
    tokens: UtilityToken[],
    classes: UtilityClassesConfig,
): { rules: UtilityRule[]; safelist: string[] } {
    const byStart = new Map<string, Use[]>();
    const safelist = new Set<string>();
    for (const [property, listed] of Object.entries(classes)) {
        for (const entry of [listed].flat()) {
            const parts = partsFor(tokens, entry, property);
            const find = (part: string) => parts.get(stripped(part, entry));
            const forced = Array.isArray(entry.safelist)
                ? entry.safelist.filter((part) => find(part) !== undefined)
                : entry.safelist
                  ? [...parts.keys()]
                  : [];
            for (const { start, property: written } of startsFor(entry, property)) {
                byStart.set(start, [...(byStart.get(start) ?? []), { property: written, find }]);
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
    };
}

function partsFor(
    tokens: UtilityToken[],
    entry: PropertyUtilityConfig,
    property: string,
): Map<string, string> {
    const base = entry.source.endsWith(".*") ? entry.source.slice(0, -2) : entry.source;
    const types = TYPES[property];
    const parts = new Map<string, string>();
    for (const token of tokens) {
        if (!("name" in token) || !token.path.startsWith(`${base}.`)) continue;
        if (types && !types.includes(token.type)) continue;
        const part = stripped(token.path.slice(base.length + 1).replaceAll(".", "-"), entry);
        if (!parts.has(part)) parts.set(part, token.name);
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
