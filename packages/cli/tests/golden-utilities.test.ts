import { ok } from "node:assert";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SugarcubeConfig, UtilityClassesConfig } from "@sugarcube-sh/core";
import { read } from "@sugarcube-sh/dtcg/node";
import { createGenerator } from "@unocss/core";
import { describe, expect, it } from "vitest";
import wwwConfig from "../../../apps/www/sugarcube.config.js";
import { fillDefaults } from "../../core/src/node/config/normalize.js";
import { readOptions } from "../../core/src/shared/read-options.js";
import { utilityRules } from "../../core/src/shared/utilities/rules.js";
import { type UtilityToken, utilityTokens } from "../../core/src/shared/utilities/tokens.js";
import studioConfig from "../../studio/sugarcube.config.js";

const ROOT = resolve(__dirname, "../../..");
const GOLDEN_DIR = join(__dirname, "__golden__");
const EVERY_VALUE_FORM = join(__dirname, "__fixtures__/every-value-form");

function withSafelist(classes: UtilityClassesConfig | undefined): UtilityClassesConfig | undefined {
    if (!classes) return undefined;
    return Object.fromEntries(
        Object.entries(classes).map(([property, entry]) => [
            property,
            Array.isArray(entry)
                ? entry.map((item) => ({ ...item, safelist: true }))
                : { ...entry, safelist: true },
        ]),
    );
}

function fromProject(
    name: string,
    config: SugarcubeConfig,
    projectDir: string,
): { name: string; resolver: string; config: SugarcubeConfig } {
    ok(config.resolver, `${name}'s config names its resolver`);
    return {
        name,
        resolver: resolve(projectDir, config.resolver),
        config: {
            variables: config.variables,
            utilities: { ...config.utilities, classes: withSafelist(config.utilities?.classes) },
        },
    };
}

const EVERY_VALUE_FORM_CLASSES: UtilityClassesConfig = {
    "color": { source: "color.*", prefix: "text", stripDuplicates: true, safelist: true },
    "background-color": { source: "color.*", prefix: "bg", safelist: true },
    "padding": {
        source: "space.*",
        prefix: "p",
        directions: ["all", "x", "y", "top", "left"],
        safelist: true,
    },
    "margin": [
        { source: "space.*", prefix: "m", directions: ["all"], safelist: ["small", "fluid"] },
        { source: "space.*", prefix: "m", directions: ["x", "bottom"], safelist: ["medium"] },
    ],
    "font-family": { source: "font.family.*", prefix: "font", safelist: true },
    "font-weight": { source: "font.weight.*", prefix: "weight", safelist: true },
    "box-shadow": { source: "shadow.*", safelist: true },
    "--flow-space": { source: "space.*", prefix: "flow", safelist: true },
};

const cases: { name: string; resolver: string; config: SugarcubeConfig }[] = [
    {
        name: "every-value-form/native",
        resolver: join(EVERY_VALUE_FORM, "tokens.resolver.json"),
        config: {
            variables: {
                prefix: "ds",
                layer: "tokens",
                propagateDependents: true,
                transforms: { fluid: { min: 360, max: 1440 }, colorFallbackStrategy: "native" },
                permutations: [
                    { input: { theme: "light" }, selector: ":root" },
                    {
                        input: { theme: "dark" },
                        selector: ":root",
                        atRule: "@media (prefers-color-scheme: dark)",
                    },
                    { input: { theme: "dark" }, selector: ['[data-theme="dark"]', ".dark"] },
                ],
            },
            utilities: { layer: "utilities", classes: EVERY_VALUE_FORM_CLASSES },
        },
    },
    {
        name: "every-value-form/polyfill",
        resolver: join(EVERY_VALUE_FORM, "polyfill/tokens.resolver.json"),
        config: {
            variables: {
                variableName: (path: string) => path.replaceAll(".", "_"),
                transforms: { colorFallbackStrategy: "polyfill" },
                permutations: [
                    { input: {}, selector: ":root" },
                    { input: { theme: "dark" }, selector: '[data-theme="dark"]', path: "dark.css" },
                ],
            },
            utilities: {
                classes: { color: { source: "color.*", prefix: "text", safelist: true } },
            },
        },
    },
    fromProject("studio/design-tokens", studioConfig, join(ROOT, "packages/studio")),
    fromProject("registry/starter-kits/fluid", wwwConfig, join(ROOT, "apps/www")),
];

interface Decision {
    because: string;
    adds?: (className: string, path: string | undefined) => boolean;
}

const decisions = {
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
} satisfies Record<string, Decision>;

const decided: Record<string, (keyof typeof decisions)[]> = {
    "every-value-form/native": ["order", "directions", "mixed"],
    "every-value-form/polyfill": ["mixed"],
    "studio/design-tokens": ["order", "mixed"],
    "registry/starter-kits/fluid": ["order"],
};

function inLayer(css: string, layer: string | undefined): string {
    if (!layer) return css;
    const indented = css.split("\n").map((line) => (line.trim() ? `    ${line}` : line));
    return `@layer ${layer} {\n${indented.join("\n")}}\n`;
}

const RULE = /^\s*\.([^{]+)\{[^:]+:var\((--[^)]+)\);\}$/;

function parsed(lines: string[]) {
    return lines.flatMap((line) => {
        const found = RULE.exec(line);
        return found?.[1] && found[2] ? [{ line, className: found[1], name: found[2] }] : [];
    });
}

function unexplained(
    css: string,
    expected: string,
    listed: (keyof typeof decisions)[],
    tokens: UtilityToken[],
): string[] {
    const [written, old] = [css.split("\n"), expected.split("\n")];
    const rules = (lines: string[]) => lines.filter((line) => RULE.test(line));
    const others = (lines: string[]) => lines.filter((line) => !RULE.test(line));
    const problems: string[] = [];
    const used = new Set<keyof typeof decisions>();
    if (others(written).join("\n") !== others(old).join("\n")) problems.push("the frame differs");
    const pathOf = new Map(
        tokens.flatMap((each) => ("name" in each ? [[each.name, each.path]] : [])),
    );
    for (const { line, className, name } of parsed(written).filter(
        (each) => !old.includes(each.line),
    )) {
        const by = listed.find((key) => {
            const decision: Decision = decisions[key];
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

describe("golden utilities: the new core writes what old sugarcube writes", () => {
    it.for(cases)("$name", async ({ name, resolver, config: base }) => {
        const config = fillDefaults({
            ...base,
            resolver,
            variables: { ...base.variables, path: "variables.css" },
        });
        const doc = await read(resolver, readOptions(config));
        const tokens = utilityTokens(doc, config);
        const { rules, safelist } = utilityRules(tokens, config.utilities.classes ?? {});
        const generator = await createGenerator({
            presets: [{ name: "sugarcube", rules, preflights: [] }],
            safelist,
        });
        const { css } = await generator.generate("", { preflights: false });
        const written = inLayer(css, config.utilities.layer);
        const expected = readFileSync(join(GOLDEN_DIR, name, "utilities.css"), "utf8");
        const listed = decided[name];
        if (listed) {
            const because = listed.map((key) => decisions[key].because).join("; ");
            expect(written, `differs because ${because} but matches`).not.toBe(expected);
            expect(unexplained(written, expected, listed, tokens)).toStrictEqual([]);
        } else expect(written).toBe(expected);
    });

    it("lists as decided only cases it runs", () => {
        const names = new Set(cases.map(({ name }) => name));
        expect(Object.keys(decided).filter((name) => !names.has(name))).toStrictEqual([]);
    });
});
