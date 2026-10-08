import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { readOptions } from "../src/shared/read-options.js";
import { utilityRules } from "../src/shared/utilities/rules.js";
import { declare } from "../src/shared/css/declare.js";
import { utilityTokens } from "../src/shared/utilities/tokens.js";
import type { UtilityClassesConfig } from "../src/types/config.js";

type Variables = Parameters<typeof fillDefaults>[0]["variables"];

const color = (value = "#111111") => ({ $type: "color", $value: value });
const px = (value: number) => ({ $type: "dimension", $value: { value, unit: "px" } });
const shadow = {
    $type: "shadow",
    $value: {
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 1, unit: "px" },
        blur: { value: 4, unit: "px" },
        spread: { value: 0, unit: "px" },
        color: "#00000040",
    },
};
const typography = {
    $type: "typography",
    $value: {
        fontFamily: "Inter",
        fontSize: { value: 16, unit: "px" },
        fontWeight: 400,
        letterSpacing: { value: 0, unit: "px" },
        lineHeight: 1.5,
    },
};

function ruledFrom(
    files: Record<string, unknown>,
    classes: UtilityClassesConfig,
    variables: Variables = {},
) {
    const config = fillDefaults({ variables: { path: "variables.css", ...variables } });
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    const doc = readFromMemory({ files: texts }, readOptions(config));
    return utilityRules(utilityTokens(declare(doc, config)), classes);
}

function ruled(tokens: unknown, classes: UtilityClassesConfig, variables: Variables = {}) {
    return ruledFrom({ "tokens.json": tokens }, classes, variables);
}

function cssFor(
    tokens: unknown,
    classes: UtilityClassesConfig,
    className: string,
    variables: Variables = {},
) {
    return ruled(tokens, classes, variables).rules.reduceRight<Record<string, string> | undefined>(
        (found, [pattern, handler]) => {
            if (found) return found;
            const match = className.match(pattern);
            return match ? handler(match) : undefined;
        },
        undefined,
    );
}

const starts = (classes: UtilityClassesConfig) =>
    ruled({}, classes).rules.map(([pattern]) => pattern.source.slice(1, -4));

describe("utilityRules", () => {
    const palette = { color: { primary: color(), secondary: color() }, space: { sm: px(8) } };

    it("writes the token's variable for the prefix and the path below source", () => {
        const classes = { color: { source: "color.*", prefix: "text" } };
        expect(cssFor(palette, classes, "text-primary")).toStrictEqual({
            color: "var(--color-primary)",
        });
        expect(cssFor(palette, classes, "text-missing")).toBeUndefined();
        expect(cssFor(palette, classes, "bg-primary")).toBeUndefined();
    });

    it("writes the variable by the name it was declared with", () => {
        expect(
            cssFor(
                { space: { "1/2": px(2) } },
                { padding: { source: "space.*", prefix: "p" } },
                "p-1/2",
                { prefix: "ds" },
            ),
        ).toStrictEqual({ padding: "var(--ds-space-1\\/2)" });
    });

    it("starts classes with the source's first segment when there is no prefix", () => {
        const tokens = { text: { lg: px(18) } };
        expect(cssFor(tokens, { "font-size": { source: "text.*" } }, "text-lg")).toStrictEqual({
            "font-size": "var(--text-lg)",
        });
        expect(
            cssFor(tokens, { "font-size": { source: "font.size.*" } }, "font-lg"),
        ).toBeUndefined();
    });

    it("joins a nested path with dashes, however its segments are written", () => {
        const tokens = { space: { "big-gap": { x: px(1) }, "inset": { small: px(2) } } };
        const classes = { padding: { source: "space.*", prefix: "p" } };
        expect(cssFor(tokens, classes, "p-big-gap-x")).toStrictEqual({
            padding: "var(--space-big-gap-x)",
        });
        expect(cssFor(tokens, classes, "p-inset-small")).toStrictEqual({
            padding: "var(--space-inset-small)",
        });
    });

    it("writes a space in a name as a dash, as its variable does", () => {
        const tokens = { type: { "body copy": { size: px(16) } } };
        const classes = { "font-size": { source: "type.*", prefix: "text", safelist: true } };
        expect(cssFor(tokens, classes, "text-body-copy-size")).toStrictEqual({
            "font-size": "var(--type-body-copy-size)",
        });
        expect(ruled(tokens, classes).safelist).toStrictEqual(["text-body-copy-size"]);
    });

    it("names a $root token's class after its group, as its variable is", () => {
        const tokens = { color: { $root: color(), accent: { $root: color() } } };
        const classes = {
            "background-color": { source: "color.*", prefix: "bg", safelist: true },
        };
        expect(cssFor(tokens, classes, "bg-accent")).toStrictEqual({
            "background-color": "var(--color-accent)",
        });
        expect(cssFor(tokens, classes, "bg-accent-$root")).toBeUndefined();
        expect(ruled(tokens, classes).safelist).toStrictEqual(["bg-accent"]);
    });

    it("takes only tokens of a type the property accepts, and any type for a custom property", () => {
        const tokens = { thing: { ink: color(), gap: px(4) } };
        expect(
            cssFor(tokens, { color: { source: "thing.*", prefix: "c" } }, "c-gap"),
        ).toBeUndefined();
        expect(
            cssFor(tokens, { "--x": { source: "thing.*", prefix: "x" } }, "x-gap"),
        ).toStrictEqual({ "--x": "var(--thing-gap)" });
    });

    it("takes a dimension for line-height and a number for font-weight, as CSS does", () => {
        const tokens = {
            leading: { loose: px(24), tight: { $type: "number", $value: 1.1 } },
            weight: { bold: { $type: "number", $value: 700 } },
        };
        const classes: UtilityClassesConfig = {
            "line-height": { source: "leading.*" },
            "font-weight": { source: "weight.*" },
        };
        expect(cssFor(tokens, classes, "leading-loose")).toStrictEqual({
            "line-height": "var(--leading-loose)",
        });
        expect(cssFor(tokens, classes, "leading-tight")).toStrictEqual({
            "line-height": "var(--leading-tight)",
        });
        expect(cssFor(tokens, classes, "weight-bold")).toStrictEqual({
            "font-weight": "var(--weight-bold)",
        });
    });

    it("gives text-shadow no class, as a shadow is written with a spread, and a custom property any", () => {
        const tokens = { shadow: { glow: shadow } };
        expect(
            cssFor(tokens, { "text-shadow": { source: "shadow.*" } }, "shadow-glow"),
        ).toBeUndefined();
        expect(
            cssFor(tokens, { "--text-shadow": { source: "shadow.*" } }, "shadow-glow"),
        ).toStrictEqual({ "--text-shadow": "var(--shadow-glow)" });
    });

    it("gives no class to a token declared as several variables", () => {
        expect(
            cssFor(
                { type: { body: typography } },
                { "--x": { source: "type.*", prefix: "x" } },
                "x-body",
            ),
        ).toBeUndefined();
    });

    describe("directions", () => {
        const space = { space: { sm: px(8), md: px(16) } };

        it("makes each direction listed, with its logical property", () => {
            const classes: UtilityClassesConfig = {
                padding: {
                    source: "space.*",
                    prefix: "p",
                    directions: ["top", "right", "bottom", "left", "x", "y"],
                },
            };
            expect(cssFor(space, classes, "pt-sm")).toStrictEqual({
                "padding-block-start": "var(--space-sm)",
            });
            expect(cssFor(space, classes, "pr-md")).toStrictEqual({
                "padding-inline-end": "var(--space-md)",
            });
            expect(cssFor(space, classes, "pb-sm")).toStrictEqual({
                "padding-block-end": "var(--space-sm)",
            });
            expect(cssFor(space, classes, "pl-md")).toStrictEqual({
                "padding-inline-start": "var(--space-md)",
            });
            expect(cssFor(space, classes, "px-sm")).toStrictEqual({
                "padding-inline": "var(--space-sm)",
            });
            expect(cssFor(space, classes, "py-md")).toStrictEqual({
                "padding-block": "var(--space-md)",
            });
            expect(cssFor(space, classes, "p-sm")).toBeUndefined();
        });

        it("makes the plain class and every direction for all", () => {
            const classes: UtilityClassesConfig = {
                padding: { source: "space.*", prefix: "p", directions: ["all"] },
            };
            expect(cssFor(space, classes, "p-sm")).toStrictEqual({ padding: "var(--space-sm)" });
            expect(cssFor(space, classes, "pl-md")).toStrictEqual({
                "padding-inline-start": "var(--space-md)",
            });
        });

        it("takes one direction written on its own", () => {
            const classes: UtilityClassesConfig = {
                margin: { source: "space.*", prefix: "m", directions: "x" },
            };
            expect(cssFor(space, classes, "mx-sm")).toStrictEqual({
                "margin-inline": "var(--space-sm)",
            });
        });

        it("makes each class start once, a shorthand before its longhands", () => {
            expect(
                starts({
                    padding: {
                        source: "space.*",
                        prefix: "p",
                        directions: ["all", "x", "y", "top", "left"],
                    },
                }),
            ).toStrictEqual(["p", "px", "py", "pt", "pr", "pb", "pl"]);
        });
    });

    it("makes rules in the config's order, an entry without a prefix where it is written", () => {
        expect(
            starts({
                "color": { source: "color.*", prefix: "text" },
                "font-size": { source: "size.*" },
                "background-color": { source: "color.*", prefix: "bg" },
            }),
        ).toStrictEqual(["text", "size", "bg"]);
    });

    it("strips the prefix from a path that repeats it, and still takes the class written in full", () => {
        const tokens = { color: { text: { muted: color() } } };
        const classes = { color: { source: "color.*", prefix: "text", stripDuplicates: true } };
        expect(cssFor(tokens, classes, "text-muted")).toStrictEqual({
            color: "var(--color-text-muted)",
        });
        expect(cssFor(tokens, classes, "text-text-muted")).toStrictEqual({
            color: "var(--color-text-muted)",
        });
    });

    it("strips the source's first segment with stripDuplicates when there is no prefix, as if it were the prefix", () => {
        const tokens = { color: { color: { ink: color() } } };
        const classes = { color: { source: "color.*", stripDuplicates: true, safelist: true } };
        expect(cssFor(tokens, classes, "color-ink")).toStrictEqual({
            color: "var(--color-color-ink)",
        });
        expect(ruled(tokens, classes).safelist).toStrictEqual(["color-ink"]);
    });

    describe("entries sharing a class start", () => {
        it("keep their directions", () => {
            const classes: UtilityClassesConfig = {
                margin: [
                    { source: "space.*", prefix: "m", directions: ["all"] },
                    { source: "space.*", prefix: "m", directions: ["x", "bottom"] },
                ],
            };
            const space = { space: { small: px(4), medium: px(8) } };
            expect(cssFor(space, classes, "mt-small")).toStrictEqual({
                "margin-block-start": "var(--space-small)",
            });
            expect(cssFor(space, classes, "mx-medium")).toStrictEqual({
                "margin-inline": "var(--space-medium)",
            });
            expect(starts(classes)).toStrictEqual(["m", "mx", "my", "mt", "mr", "mb", "ml"]);
        });

        it("are tried in the config's order", () => {
            const tokens = { color: { primary: color() }, size: { base: px(16) } };
            const classes = {
                "color": { source: "color.*", prefix: "brand" },
                "background-color": { source: "color.*", prefix: "brand" },
                "font-size": { source: "size.*", prefix: "brand" },
            };
            expect(starts(classes)).toStrictEqual(["brand"]);
            expect(cssFor(tokens, classes, "brand-primary")).toStrictEqual({
                color: "var(--color-primary)",
            });
            expect(cssFor(tokens, classes, "brand-base")).toStrictEqual({
                "font-size": "var(--size-base)",
            });
        });
    });

    it("answers a class two tokens make with the first in file order", () => {
        const tokens = { color: { "bg-offset": color(), "bg": { offset: color() } } };
        expect(
            cssFor(tokens, { color: { source: "color.*", prefix: "text" } }, "text-bg-offset", {
                variableName: (path) => path.replaceAll(".", "_"),
            }),
        ).toStrictEqual({ color: "var(--color_bg-offset)" });
    });

    it("lets a class reach past a rule whose start it also has", () => {
        const tokens = {
            font: {
                weight: { bold: { $type: "fontWeight", $value: 700 } },
                sans: { $type: "fontFamily", $value: "Inter" },
            },
        };
        const classes = {
            "font-weight": { source: "font.weight.*", prefix: "font-weight" },
            "font-family": { source: "font.*", prefix: "font" },
        };
        expect(cssFor(tokens, classes, "font-weight-bold")).toStrictEqual({
            "font-weight": "var(--font-weight-bold)",
        });
        expect(cssFor(tokens, classes, "font-sans")).toStrictEqual({
            "font-family": "var(--font-sans)",
        });
    });

    it("keeps nothing between calls", () => {
        const tokens = { color: { ink: color() } };
        const classes = { color: { source: "color.*", prefix: "text" } };
        expect(cssFor(tokens, classes, "text-ink", { prefix: "ds" })).toStrictEqual({
            color: "var(--ds-color-ink)",
        });
        expect(
            cssFor(tokens, classes, "text-ink", {
                variableName: (path) => path.replaceAll(".", "_"),
            }),
        ).toStrictEqual({ color: "var(--color_ink)" });
    });
});

describe("utilityRules' starts, the rules as data", () => {
    const classes = { color: { source: "color.*", prefix: "text" } };

    it("are the same for tokens that make the same classes, whatever their values", () => {
        const before = ruled({ color: { ink: color("#111111") } }, classes).starts;
        const after = ruled({ color: { ink: color("#222222") } }, classes).starts;
        expect(after).toStrictEqual(before);
    });

    it("differ when a token makes a class no token made before", () => {
        const before = ruled({ color: { ink: color() } }, classes).starts;
        const after = ruled({ color: { ink: color(), paper: color() } }, classes).starts;
        expect(after).not.toStrictEqual(before);
    });

    it("differ when a class writes another variable", () => {
        const before = ruled({ color: { ink: color() } }, classes).starts;
        const after = ruled({ color: { ink: color() } }, classes, { prefix: "ds" }).starts;
        expect(after).not.toStrictEqual(before);
    });
});

describe("utilityRules' safelist", () => {
    const tokens = {
        color: { primary: color(), danger: color(), text: { muted: color() } },
        space: { sm: px(8) },
    };
    const safelistFor = (classes: UtilityClassesConfig) =>
        [...ruled(tokens, classes).safelist].sort();

    it("is empty when no entry asks for one", () => {
        expect(safelistFor({ color: { source: "color.*", prefix: "text" } })).toStrictEqual([]);
        expect(
            safelistFor({ color: { source: "color.*", prefix: "text", safelist: false } }),
        ).toStrictEqual([]);
    });

    it("lists a class for every token under source for true", () => {
        expect(
            safelistFor({
                "background-color": { source: "color.*", prefix: "bg", safelist: true },
            }),
        ).toStrictEqual(["bg-danger", "bg-primary", "bg-text-muted"]);
    });

    it("lists the classes named, when a token answers them", () => {
        expect(
            safelistFor({
                "background-color": {
                    source: "color.*",
                    prefix: "bg",
                    safelist: ["primary", "danger", "missing"],
                },
            }),
        ).toStrictEqual(["bg-danger", "bg-primary"]);
    });

    it("lists each direction", () => {
        expect(
            safelistFor({
                padding: { source: "space.*", prefix: "p", directions: ["all"], safelist: true },
            }),
        ).toStrictEqual(["p-sm", "pb-sm", "pl-sm", "pr-sm", "pt-sm", "px-sm", "py-sm"]);
    });

    it("lists the stripped class with stripDuplicates", () => {
        expect(
            safelistFor({
                color: { source: "color.*", prefix: "text", stripDuplicates: true, safelist: true },
            }),
        ).toStrictEqual(["text-danger", "text-muted", "text-primary"]);
    });

    it("lists only classes the rules answer", () => {
        const classes: UtilityClassesConfig = {
            "color": { source: "color.*", prefix: "text", stripDuplicates: true, safelist: true },
            "background-color": { source: "color.*", prefix: "bg", safelist: ["primary"] },
            "margin": [
                { source: "space.*", prefix: "m", directions: ["all"], safelist: true },
                { source: "space.*", prefix: "m", directions: ["x", "y"], safelist: ["sm"] },
            ],
        };
        const { safelist } = ruled(tokens, classes);
        expect(safelist.length).toBeGreaterThan(0);
        for (const className of safelist) {
            expect(cssFor(tokens, classes, className), className).toBeDefined();
        }
    });
});

describe("utilityRules' warning for a class two tokens make", () => {
    const warnings = (tokens: unknown, classes: UtilityClassesConfig, variables?: Variables) =>
        ruled(tokens, classes, variables)
            .diagnostics.filter(({ kind }) => kind === "same-utility-class")
            .map(({ kind, severity, path, message }) => [kind, severity, path, message]);
    const clash = (className: string, used: string, other: string) =>
        `\`${className}\` could mean \`${used}\` or \`${other}\`, so it uses \`${used}\`: rename one, or change the entry's \`prefix\``;

    it("on the token not used, naming both, once however many directions make it", () => {
        const tokens = { color: { muted: color(), text: { muted: color() } } };
        const classes: UtilityClassesConfig = {
            color: { source: "color.*", prefix: "text", stripDuplicates: true },
        };
        expect(warnings(tokens, classes)).toStrictEqual([
            [
                "same-utility-class",
                "warning",
                "color.text.muted",
                clash("text-muted", "color.muted", "color.text.muted"),
            ],
        ]);
        const space = { space: { "big-gap": px(1), "big": { gap: px(2) } } };
        expect(
            warnings(
                space,
                { padding: { source: "space.*", prefix: "p", directions: ["all"] } },
                { variableName: (path) => path.replaceAll(".", "_") },
            ),
        ).toStrictEqual([
            [
                "same-utility-class",
                "warning",
                "space.big.gap",
                clash("p-big-gap", "space.big-gap", "space.big.gap"),
            ],
        ]);
    });

    it("across entries sharing a start", () => {
        const tokens = { color: { brand: { primary: color() }, semantic: { primary: color() } } };
        const classes: UtilityClassesConfig = {
            color: [
                { source: "color.brand.*", prefix: "text" },
                { source: "color.semantic.*", prefix: "text" },
            ],
        };
        expect(warnings(tokens, classes)).toStrictEqual([
            [
                "same-utility-class",
                "warning",
                "color.semantic.primary",
                clash("text-primary", "color.brand.primary", "color.semantic.primary"),
            ],
        ]);
    });

    it("across starts, naming the later rule's token, as UnoCSS uses it", () => {
        const tokens = { color: { x: { y: color() } }, tone: { y: color() } };
        const classes: UtilityClassesConfig = {
            "color": { source: "color.*", prefix: "text" },
            "--tone": { source: "tone.*", prefix: "text-x" },
        };
        expect(cssFor(tokens, classes, "text-x-y")).toStrictEqual({ "--tone": "var(--tone-y)" });
        expect(warnings(tokens, classes)).toStrictEqual([
            [
                "same-utility-class",
                "warning",
                "color.x.y",
                clash("text-x-y", "tone.y", "color.x.y"),
            ],
        ]);
    });

    it("naming the token UnoCSS uses when entries sharing a start meet a later start", () => {
        const tokens = {
            color: { brand: { x: { y: color() } }, semantic: { x: { y: color() } } },
            tone: { y: color() },
        };
        const classes: UtilityClassesConfig = {
            "color": [
                { source: "color.brand.*", prefix: "text" },
                { source: "color.semantic.*", prefix: "text" },
            ],
            "--tone": { source: "tone.*", prefix: "text-x" },
        };
        expect(cssFor(tokens, classes, "text-x-y")).toStrictEqual({ "--tone": "var(--tone-y)" });
        expect(warnings(tokens, classes)).toStrictEqual([
            [
                "same-utility-class",
                "warning",
                "color.brand.x.y",
                clash("text-x-y", "tone.y", "color.brand.x.y"),
            ],
            [
                "same-utility-class",
                "warning",
                "color.semantic.x.y",
                clash("text-x-y", "tone.y", "color.semantic.x.y"),
            ],
        ]);
    });

    it("once for a pair, whichever of the two each class uses", () => {
        const tokens = { color: { p: color() }, tone: { p: color() } };
        const classes: UtilityClassesConfig = {
            "color": { source: "color.*", prefix: "a" },
            "--a": { source: "tone.*", prefix: "a" },
            "--b": { source: "tone.*", prefix: "b" },
            "--c": { source: "color.*", prefix: "b" },
        };
        expect(cssFor(tokens, classes, "a-p")).toStrictEqual({ color: "var(--color-p)" });
        expect(cssFor(tokens, classes, "b-p")).toStrictEqual({ "--b": "var(--tone-p)" });
        expect(warnings(tokens, classes)).toStrictEqual([
            ["same-utility-class", "warning", "tone.p", clash("a-p", "color.p", "tone.p")],
        ]);
    });

    it("not when both tokens write the same variable, or one token answers two entries", () => {
        const tokens = { color: { "bg-offset": color(), "bg": { offset: color() } } };
        expect(warnings(tokens, { color: { source: "color.*", prefix: "text" } })).toStrictEqual(
            [],
        );
        expect(
            warnings(
                { color: { primary: color() } },
                {
                    "color": { source: "color.*", prefix: "brand" },
                    "background-color": { source: "color.*", prefix: "brand" },
                },
            ),
        ).toStrictEqual([]);
    });
});

describe("utilityRules' warning for an entry that makes no classes", () => {
    const messagesOf = ({ diagnostics }: ReturnType<typeof utilityRules>) =>
        diagnostics
            .filter(({ kind }) => kind === "utility-without-classes")
            .map(({ message }) => message);
    const reported = (tokens: unknown, classes: UtilityClassesConfig) =>
        messagesOf(ruled(tokens, classes));

    it("when its source matches no token", () => {
        expect(
            reported(
                { color: { ink: color() } },
                { color: { source: "colour.*", prefix: "text" } },
            ),
        ).toStrictEqual(["`color` makes no classes: there are no tokens under `colour`"]);
    });

    it("not when there are no tokens at all, as when they could not be read", () => {
        expect(reported({}, { color: { source: "color.*", prefix: "text" } })).toStrictEqual([]);
    });

    it("when every token it could use is private", () => {
        const files = {
            "tokens.resolver.json": {
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "set",
                        name: "palette",
                        sources: [{ $ref: "palette.json" }],
                        $extensions: { "sh.sugarcube": { emit: false } },
                    },
                    { type: "set", name: "semantic", sources: [{ $ref: "semantic.json" }] },
                ],
            },
            "palette.json": { brand: { rose: color() } },
            "semantic.json": { ink: color("{brand.rose}") },
        };
        expect(
            messagesOf(ruledFrom(files, { color: { source: "brand.*", prefix: "text" } })),
        ).toStrictEqual([
            "`color` makes no classes: the tokens under `brand.*` are private, and a class needs a variable",
        ]);
    });

    it("when none of its tokens is of a type the property takes", () => {
        const tokens = { color: { ink: color() }, tone: { soft: { $type: "number", $value: 1 } } };
        expect(
            reported(tokens, {
                "padding": { source: "color.*", prefix: "p" },
                "line-height": { source: "color.*", prefix: "leading" },
            }),
        ).toStrictEqual([
            "`padding` makes no classes: `color.*` has only color tokens, and it takes dimension",
            "`line-height` makes no classes: `color.*` has only color tokens, and it takes number or dimension",
        ]);
    });

    it("when it has only typography, whatever the property", () => {
        expect(
            reported(
                { type: { body: typography } },
                { "--font": { source: "type.*", prefix: "type" } },
            ),
        ).toStrictEqual([
            "`--font` makes no classes: `type.*` has only typography tokens, which a single-property class cannot use",
        ]);
    });

    it("for text-shadow, which no token type can be written as", () => {
        expect(
            reported(
                { shadow: { glow: shadow } },
                { "text-shadow": { source: "shadow.*", prefix: "glow" } },
            ),
        ).toStrictEqual(["`text-shadow` makes no classes: DTCG has no text shadow type"]);
    });

    it("when another entry answers every class it makes", () => {
        expect(
            reported(
                { color: { ink: color(), rose: color() } },
                { "color": { source: "color.*" }, "background-color": { source: "color.*" } },
            ),
        ).toStrictEqual([
            "`background-color` makes no classes: every `color-…` class is answered by `color` first; give one of them a `prefix`",
        ]);
    });

    it("naming an entry by its place when the property lists several, and every start and answer", () => {
        expect(
            reported(
                { space: { sm: px(4) } },
                {
                    "padding": { source: "space.*", prefix: "mb" },
                    "--inline": { source: "space.*", prefix: "mx" },
                    "margin": [
                        { source: "space.*", prefix: "m", directions: ["top"] },
                        { source: "space.*", prefix: "m", directions: ["x", "bottom"] },
                    ],
                },
            ),
        ).toStrictEqual([
            "`margin`'s 2nd entry makes no classes: every `mb-…` and `mx-…` class is answered by `padding` and `--inline` first; give one of them a `prefix`",
        ]);
    });

    it("as a warning about the config, carrying the entry and the reason as facts", () => {
        const { diagnostics } = ruled(
            { color: { ink: color() } },
            {
                margin: [
                    { source: "space.*", prefix: "m" },
                    { source: "color.*", prefix: "p" },
                ],
                color: { source: "colour.*" },
            },
        );
        expect(
            diagnostics.map(({ kind, severity, path, at, detail }) => [
                kind,
                severity,
                path,
                at,
                detail,
            ]),
        ).toStrictEqual([
            [
                "utility-without-classes",
                "warning",
                undefined,
                undefined,
                {
                    property: "margin",
                    entry: 0,
                    source: "space.*",
                    reason: "no-tokens",
                    group: "space",
                },
            ],
            [
                "utility-without-classes",
                "warning",
                undefined,
                undefined,
                {
                    property: "margin",
                    entry: 1,
                    source: "color.*",
                    reason: "wrong-type",
                    found: ["color"],
                    takes: ["dimension"],
                },
            ],
            [
                "utility-without-classes",
                "warning",
                undefined,
                undefined,
                { property: "color", source: "colour.*", reason: "no-tokens", group: "colour" },
            ],
        ]);
    });

    it("not when some of its classes are answered by another entry", () => {
        expect(
            reported(
                { color: { ink: color(), bg: { ink: color() } } },
                {
                    "color": { source: "color.*" },
                    "background-color": { source: "color.bg.*", prefix: "color-bg" },
                },
            ),
        ).toStrictEqual([]);
    });

    it("not when another entry writes the same CSS for every class it makes", () => {
        expect(
            reported(
                { space: { sm: px(4) } },
                {
                    margin: [
                        { source: "space.*", prefix: "m", directions: ["all"] },
                        { source: "space.*", prefix: "m", directions: ["x", "bottom"] },
                    ],
                },
            ),
        ).toStrictEqual([]);
    });

    it("not when each class it loses goes to another token, which the same-class warning names", () => {
        const { diagnostics } = ruled(
            { color: { brand: { primary: color() }, semantic: { primary: color() } } },
            {
                color: [
                    { source: "color.brand.*", prefix: "text" },
                    { source: "color.semantic.*", prefix: "text" },
                ],
            },
        );
        expect(diagnostics.map(({ kind }) => kind)).toStrictEqual(["same-utility-class"]);
    });

    it("not when it matches only tokens that could not be written, which report themselves", () => {
        expect(
            reported(
                { color: { broken: color("not a color") } },
                { color: { source: "color.*", prefix: "text" } },
            ),
        ).toStrictEqual([]);
    });
});

describe("utilityRules' warning for a safelisted class no token makes", () => {
    const palette = { color: { primary: color(), text: { muted: color() } } };
    const reported = (classes: UtilityClassesConfig) =>
        ruled(palette, classes)
            .diagnostics.filter(({ kind }) => kind === "safelist-without-token")
            .map(({ message }) => message);

    it("names the part and the entry", () => {
        expect(
            reported({
                "background-color": { source: "color.*", prefix: "bg", safelist: ["primray"] },
            }),
        ).toStrictEqual([
            "`primray` in `background-color`'s safelist matches no token, so no class is forced",
        ]);
    });

    it("as a warning about the config, carrying the entry and the part as facts", () => {
        const { diagnostics } = ruled(palette, {
            color: [
                { source: "color.*", prefix: "text" },
                { source: "color.*", prefix: "ink", safelist: ["primary", "teal"] },
            ],
        });
        expect(
            diagnostics.map(({ kind, severity, path, at, detail }) => [
                kind,
                severity,
                path,
                at,
                detail,
            ]),
        ).toStrictEqual([
            [
                "safelist-without-token",
                "warning",
                undefined,
                undefined,
                { property: "color", entry: 1, part: "teal" },
            ],
        ]);
    });

    it("not for a part written stripped or in full with stripDuplicates", () => {
        expect(
            reported({
                color: {
                    source: "color.*",
                    prefix: "text",
                    stripDuplicates: true,
                    safelist: ["muted", "text-muted"],
                },
            }),
        ).toStrictEqual([]);
    });

    it("not when the entry makes no classes, which its own warning explains", () => {
        expect(
            reported({ color: { source: "colour.*", prefix: "text", safelist: ["primary"] } }),
        ).toStrictEqual([]);
    });
});

describe("utilityRules' warning that the direction full is deprecated", () => {
    const space = { space: { md: { $type: "dimension", $value: { value: 1, unit: "rem" } } } };
    const reported = (classes: UtilityClassesConfig) =>
        ruled(space, classes).diagnostics.map(({ kind, severity, message }) => [
            kind,
            severity,
            message,
        ]);

    it("names the entry, beside directions that make classes", () => {
        expect(
            reported({ padding: { source: "space.*", prefix: "p", directions: ["full", "x"] } }),
        ).toStrictEqual([
            [
                "option-deprecated",
                "warning",
                '`directions: "full"` in `padding` is deprecated and will be removed in a later release',
            ],
        ]);
    });

    it("once, where full is the only direction and so the entry makes no classes", () => {
        expect(
            reported({ padding: { source: "space.*", prefix: "p", directions: "full" } }).map(
                ([kind]) => kind,
            ),
        ).toStrictEqual(["option-deprecated"]);
    });
});
