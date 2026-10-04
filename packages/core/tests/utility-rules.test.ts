import { describe, expect, it } from "vitest";
import type { UtilityClassesConfig } from "../src/types/config.js";
import { utilityRules } from "../src/shared/utilities/rules.js";
import type { UtilityToken } from "../src/shared/utilities/tokens.js";

const color = (path: string, name = `--${path.replaceAll(".", "-")}`): UtilityToken => ({
    path,
    type: "color",
    name,
});
const dimension = (path: string, name = `--${path.replaceAll(".", "-")}`): UtilityToken => ({
    path,
    type: "dimension",
    name,
});

function cssFor(tokens: UtilityToken[], classes: UtilityClassesConfig, className: string) {
    return utilityRules(tokens, classes).rules.reduceRight<Record<string, string> | undefined>(
        (found, [pattern, handler]) => {
            if (found) return found;
            const match = className.match(pattern);
            return match ? handler(match) : undefined;
        },
        undefined,
    );
}

const starts = (classes: UtilityClassesConfig, tokens: UtilityToken[] = []) =>
    utilityRules(tokens, classes).rules.map(([pattern]) => pattern.source.slice(1, -4));

describe("utilityRules", () => {
    const palette = [color("color.primary"), color("color.secondary"), dimension("space.sm")];

    it("writes the token's variable for the prefix and the path below source", () => {
        const classes = { color: { source: "color.*", prefix: "text" } };
        expect(cssFor(palette, classes, "text-primary")).toStrictEqual({
            color: "var(--color-primary)",
        });
        expect(cssFor(palette, classes, "text-missing")).toBeUndefined();
        expect(cssFor(palette, classes, "bg-primary")).toBeUndefined();
    });

    it("writes the variable by the name it was declared with", () => {
        const tokens = [dimension("space.1/2", "--ds-space-1\\/2")];
        expect(
            cssFor(tokens, { padding: { source: "space.*", prefix: "p" } }, "p-1/2"),
        ).toStrictEqual({ padding: "var(--ds-space-1\\/2)" });
    });

    it("starts classes with the source's first segment when there is no prefix", () => {
        const tokens = [dimension("text.lg")];
        expect(cssFor(tokens, { "font-size": { source: "text.*" } }, "text-lg")).toStrictEqual({
            "font-size": "var(--text-lg)",
        });
        expect(
            cssFor(tokens, { "font-size": { source: "font.size.*" } }, "font-lg"),
        ).toBeUndefined();
    });

    it("joins a nested path with dashes, however its segments are written", () => {
        const tokens = [dimension("space.big-gap.x"), dimension("space.inset.small")];
        const classes = { padding: { source: "space.*", prefix: "p" } };
        expect(cssFor(tokens, classes, "p-big-gap-x")).toStrictEqual({
            padding: "var(--space-big-gap-x)",
        });
        expect(cssFor(tokens, classes, "p-inset-small")).toStrictEqual({
            padding: "var(--space-inset-small)",
        });
    });

    it("takes only tokens of a type the property accepts, and any type for a custom property", () => {
        const tokens = [color("thing.ink"), dimension("thing.gap")];
        expect(
            cssFor(tokens, { color: { source: "thing.*", prefix: "c" } }, "c-gap"),
        ).toBeUndefined();
        expect(
            cssFor(tokens, { "--x": { source: "thing.*", prefix: "x" } }, "x-gap"),
        ).toStrictEqual({
            "--x": "var(--thing-gap)",
        });
    });

    it("gives no class to a token declared as several variables", () => {
        const body: UtilityToken = {
            path: "type.body",
            type: "typography",
            variables: [{ property: "font-size", name: "--type-body-font-size" }],
        };
        expect(
            cssFor([body], { "--x": { source: "type.*", prefix: "x" } }, "x-body"),
        ).toBeUndefined();
    });

    describe("directions", () => {
        const space = [dimension("space.sm"), dimension("space.md")];

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
        const tokens = [color("color.text.muted")];
        const classes = { color: { source: "color.*", prefix: "text", stripDuplicates: true } };
        expect(cssFor(tokens, classes, "text-muted")).toStrictEqual({
            color: "var(--color-text-muted)",
        });
        expect(cssFor(tokens, classes, "text-text-muted")).toStrictEqual({
            color: "var(--color-text-muted)",
        });
    });

    describe("entries sharing a class start", () => {
        it("keep their directions", () => {
            const space = [dimension("space.small"), dimension("space.medium")];
            const classes: UtilityClassesConfig = {
                margin: [
                    { source: "space.*", prefix: "m", directions: ["all"] },
                    { source: "space.*", prefix: "m", directions: ["x", "bottom"] },
                ],
            };
            expect(cssFor(space, classes, "mt-small")).toStrictEqual({
                "margin-block-start": "var(--space-small)",
            });
            expect(cssFor(space, classes, "mx-medium")).toStrictEqual({
                "margin-inline": "var(--space-medium)",
            });
            expect(starts(classes)).toStrictEqual(["m", "mx", "my", "mt", "mr", "mb", "ml"]);
        });

        it("are tried in the config's order", () => {
            const tokens = [color("color.primary"), dimension("size.base")];
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
        const tokens = [color("color.bg-offset", "--a"), color("color.bg.offset", "--b")];
        expect(
            cssFor(tokens, { color: { source: "color.*", prefix: "text" } }, "text-bg-offset"),
        ).toStrictEqual({ color: "var(--a)" });
    });

    it("lets a class reach past a rule whose start it also has", () => {
        const tokens = [
            { path: "font.weight.bold", type: "fontWeight", name: "--font-weight-bold" },
            { path: "font.sans", type: "fontFamily", name: "--font-sans" },
        ] satisfies UtilityToken[];
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
        const classes = { color: { source: "color.*", prefix: "text" } };
        expect(cssFor([color("color.ink", "--ds-color-ink")], classes, "text-ink")).toStrictEqual({
            color: "var(--ds-color-ink)",
        });
        expect(cssFor([color("color.ink", "--color_ink")], classes, "text-ink")).toStrictEqual({
            color: "var(--color_ink)",
        });
    });
});

describe("utilityRules' safelist", () => {
    const tokens = [
        color("color.primary"),
        color("color.danger"),
        color("color.text.muted"),
        dimension("space.sm"),
    ];
    const safelistFor = (classes: UtilityClassesConfig) =>
        [...utilityRules(tokens, classes).safelist].sort();

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
        const { safelist } = utilityRules(tokens, classes);
        expect(safelist.length).toBeGreaterThan(0);
        for (const className of safelist) {
            expect(cssFor(tokens, classes, className), className).toBeDefined();
        }
    });
});
