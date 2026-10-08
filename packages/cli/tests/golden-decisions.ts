import type { UtilityToken } from "../../core/src/shared/utilities/tokens.js";

interface VariablesDecision {
    because: string;
    explains?: (before: string, after: string) => boolean;
    adds?: (name: string, value: string, block: number) => boolean;
    drops?: (name: string) => boolean;
}

function asHex(rgb: string): string | undefined {
    const found = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(rgb);
    if (!found) return undefined;
    const pair = (channel: number) => channel.toString(16).padStart(2, "0");
    const alpha = found[4] === undefined ? 1 : Number(found[4]);
    const channels = [found[1], found[2], found[3]].map((each) => pair(Number(each)));
    return `#${channels.join("")}${alpha === 1 ? "" : pair(Math.round(alpha * 255))}`;
}

const variablesDecisions = {
    order: {
        because:
            "whole-number keys stay where the file writes them; old sugarcube sorted them first",
    },
    fluid: {
        because:
            "fluid sizes are worked out as Utopia does, to four decimals, with a size that shrinks as the screen widens kept in order",
        explains: (before, after) => before.startsWith("clamp(") && after.startsWith("clamp("),
    },
    dashed: {
        because: "CSS cannot draw a dash pattern, so one is written dashed (Format 9.3.3)",
        explains: (before, after) =>
            /\b(round|butt|square)\b/.test(before) &&
            /\bdashed\b/.test(after) &&
            !/\b(round|butt|square)\b/.test(after),
    },
    hex: {
        because: "an sRGB color with a hex is written as that hex, the same color (P-017)",
        explains: (before, after) => asHex(before) === after.toLowerCase(),
    },
    alpha: {
        because:
            "a polyfill fallback keeps its color's alpha, as eight-digit hex, as the Color module intends",
        explains: (before, after) =>
            /^#[0-9a-f]{6}$/i.test(before) && after.length === 9 && after.startsWith(before),
    },
    redeclare: {
        because:
            "a later block re-declares every variable referring to something it changes, by default",
        adds: (_name, value, block) => block > 0 && value.includes("var("),
    },
    partial: {
        because:
            "typography needs all five properties (Format 9.8), so typography.partial is an error and writes nothing",
        drops: (name) => name.startsWith("--ds-typography-partial-"),
    },
} satisfies Record<string, VariablesDecision>;

export const decidedVariables: Record<string, (keyof typeof variablesDecisions)[]> = {
    "studio/design-tokens/variables.css": ["order", "redeclare"],
    "core/tokens/fluid/variables.css": ["fluid"],
    "studio/demo/variables.css": ["fluid", "dashed", "redeclare"],
    "registry/starter-kits/fluid/variables.css": ["fluid", "redeclare"],
    "registry/starter-kits/static/variables.css": ["redeclare"],
    "core/resolver/complex/variables.css": ["redeclare"],
    "core/resolver/propagate-chain/variables.css": ["redeclare"],
    "every-value-form/native/variables.css": ["hex", "fluid", "dashed", "partial"],
    "every-value-form/polyfill/variables.css": ["hex", "alpha"],
    "every-value-form/polyfill/dark.css": ["hex", "alpha"],
    "registry/recipes/size-demo/variables.css": ["fluid"],
    "registry/recipes/space-demo/variables.css": ["fluid"],
};

interface Block {
    selector: string;
    names: string[];
    values: Map<string, string>;
}

function blocksOf(css: string): Block[] {
    return css
        .trimEnd()
        .split("\n\n")
        .map((block) => {
            const lines = block.split("\n");
            const declared = lines.flatMap((line) => {
                const found = /^\s+(--[^:]+): (.*);$/.exec(line);
                return found?.[1] && found[2] !== undefined ? [[found[1], found[2]] as const] : [];
            });
            return {
                selector: lines
                    .filter((line) => !/^\s+--/.test(line) && line.trim() !== "}")
                    .join("\n"),
                names: declared.map(([name]) => name),
                values: new Map(declared),
            };
        });
}

function unexplainedVariables(
    css: string,
    expected: string,
    listed: (keyof typeof variablesDecisions)[],
) {
    const [written, old] = [blocksOf(css), blocksOf(expected)];
    const decision = (key: keyof typeof variablesDecisions): VariablesDecision =>
        variablesDecisions[key];
    const used = new Set<keyof typeof variablesDecisions>(
        listed.includes("order") ? ["order"] : [],
    );
    const problems: string[] = [];
    const explainedBy = (test: (each: VariablesDecision) => boolean | undefined) => {
        const by = listed.find((key) => test(decision(key)));
        if (by) used.add(by);
        return by;
    };
    if (
        written.map(({ selector }) => selector).join() !==
        old.map(({ selector }) => selector).join()
    )
        problems.push("the blocks differ");
    written.forEach((block, index) => {
        const before = old[index]?.names ?? [];
        for (const name of block.names.filter((each) => !before.includes(each))) {
            const value = block.values.get(name) ?? "";
            if (!explainedBy((each) => each.adds?.(name, value, index)))
                problems.push(`${name}: added`);
        }
        for (const name of before.filter((each) => !block.names.includes(each))) {
            if (!explainedBy((each) => each.drops?.(name))) problems.push(`${name}: dropped`);
        }
        const [kept, wereKept] = [
            block.names.filter((each) => before.includes(each)),
            before.filter((each) => block.names.includes(each)),
        ];
        const order = (names: string[]) =>
            (listed.includes("order") ? [...names].sort() : names).join();
        if (order(kept) !== order(wereKept)) problems.push(`${block.selector}: the order differs`);
        for (const name of kept) {
            const [after, was] = [block.values.get(name), old[index]?.values.get(name)];
            if (after === undefined || was === undefined || after === was) continue;
            if (!explainedBy((each) => each.explains?.(was, after)))
                problems.push(`${name}: ${was} → ${after}`);
        }
    });
    for (const key of listed) if (!used.has(key)) problems.push(`${key} explains nothing here`);
    return problems;
}

interface UtilitiesDecision {
    because: string;
    adds?: (className: string, path: string | undefined) => boolean;
}

const utilitiesDecisions = {
    order: {
        because:
            "utility classes come in the config's order, each shorthand before its longhands, so a longhand wins over its shorthand",
    },
    directions: {
        because: "utility entries sharing a prefix keep their directions",
        adds: (className) => /^m[xytrbl]-/.test(className),
    },
    mixed: {
        because:
            "a token whose path mixes hyphens and dots below its first segment gets its class, which old sugarcube skipped",
        adds: (_className, path) => {
            const below = path?.slice(path.indexOf(".") + 1);
            return below !== undefined && below.includes(".") && below.includes("-");
        },
    },
} satisfies Record<string, UtilitiesDecision>;

export const decidedUtilities: Record<string, (keyof typeof utilitiesDecisions)[]> = {
    "every-value-form/native": ["order", "directions", "mixed"],
    "every-value-form/polyfill": ["mixed"],
    "studio/design-tokens": ["order", "mixed"],
    "registry/starter-kits/fluid": ["order"],
};

const RULE = /^\s*\.([^{]+)\{[^:]+:var\((--[^)]+)\);\}$/;

function parsed(lines: string[]) {
    return lines.flatMap((line) => {
        const found = RULE.exec(line);
        return found?.[1] && found[2] ? [{ line, className: found[1], name: found[2] }] : [];
    });
}

function unexplainedUtilities(
    css: string,
    expected: string,
    listed: (keyof typeof utilitiesDecisions)[],
    tokens: UtilityToken[],
): string[] {
    const [written, old] = [css.split("\n"), expected.split("\n")];
    const rules = (lines: string[]) => lines.filter((line) => RULE.test(line));
    const others = (lines: string[]) => lines.filter((line) => !RULE.test(line));
    const problems: string[] = [];
    const used = new Set<keyof typeof utilitiesDecisions>();
    if (others(written).join("\n") !== others(old).join("\n")) problems.push("the frame differs");
    const pathOf = new Map(
        tokens.flatMap((each) => ("name" in each ? [[each.name, each.token.path]] : [])),
    );
    for (const { line, className, name } of parsed(written).filter(
        (each) => !old.includes(each.line),
    )) {
        const by = listed.find((key) => {
            const decision: UtilitiesDecision = utilitiesDecisions[key];
            return decision.adds?.(className, pathOf.get(name));
        });
        if (by) used.add(by);
        else problems.push(`${line.trim()}: added`);
    }
    for (const line of rules(old).filter((each) => !written.includes(each))) {
        problems.push(`${line.trim()}: dropped`);
    }
    const kept = rules(written).filter((each) => old.includes(each));
    const wereKept = rules(old).filter((each) => written.includes(each));
    if (kept.join("\n") !== wereKept.join("\n")) {
        if (listed.includes("order")) used.add("order");
        else problems.push("the order differs");
    }
    for (const key of listed) if (!used.has(key)) problems.push(`${key} explains nothing here`);
    return problems;
}

export interface Explained {
    because: string;
    unexplained: string[];
}

export function explainVariables(
    file: string,
    css: string,
    expected: string,
): Explained | undefined {
    const listed = decidedVariables[file];
    if (!listed) return undefined;
    return {
        because: listed.map((key) => variablesDecisions[key].because).join("; "),
        unexplained: unexplainedVariables(css, expected, listed),
    };
}

export function explainUtilities(
    name: string,
    css: string,
    expected: string,
    tokens: UtilityToken[],
): Explained | undefined {
    const listed = decidedUtilities[name];
    if (!listed) return undefined;
    return {
        because: listed.map((key) => utilitiesDecisions[key].because).join("; "),
        unexplained: unexplainedUtilities(css, expected, listed, tokens),
    };
}
