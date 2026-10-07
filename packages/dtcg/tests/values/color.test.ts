import { describe, expect, it } from "vitest";
import type { ParseOptions } from "../../src/index.js";
import { parseColor } from "../../src/values.js";

const lenient: ParseOptions = { ignoreUnknownProperties: true };

function read(raw: unknown, options?: ParseOptions) {
    const result = parseColor(raw, ["$value"], options);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown, options?: ParseOptions) {
    const result = parseColor(raw, ["$value"], options);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

function ignored(raw: unknown, options?: ParseOptions) {
    const result = parseColor(raw, ["$value"], options);
    return result.ignored.map(({ path, detail }) => ({ path, detail }));
}

describe("parseColor", () => {
    describe("reads", () => {
        it.for([
            { colorSpace: "srgb", components: [1, 0, 1] },
            { colorSpace: "srgb-linear", components: [1, 0, 1] },
            { colorSpace: "hsl", components: [330, 100, 50] },
            { colorSpace: "hwb", components: [330, 0, 0] },
            { colorSpace: "lab", components: [60.17, 93.54, -60.5] },
            { colorSpace: "lch", components: [60.17, 111.4, 327.11] },
            { colorSpace: "oklab", components: [0.701, 0.2746, -0.169] },
            { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363] },
            { colorSpace: "display-p3", components: [1, 0, 1] },
            { colorSpace: "a98-rgb", components: [1, 0, 1] },
            { colorSpace: "prophoto-rgb", components: [1, 0, 1] },
            { colorSpace: "rec2020", components: [1, 0, 1] },
            { colorSpace: "xyz-d65", components: [0.5929, 0.2848, 0.9699] },
            { colorSpace: "xyz-d50", components: [0.5791, 0.2831, 0.728] },
        ])("the spec's hot pink in $colorSpace", ({ colorSpace, components }) => {
            expect(read({ colorSpace, components, alpha: 1, hex: "#ff00ff" })).toStrictEqual({
                colorSpace,
                components,
                alpha: 1,
                hex: "#ff00ff",
            });
        });

        it("fills in alpha as 1, and adds no hex, when both are left out", () => {
            expect(read({ colorSpace: "srgb", components: [1, 0, 0] })).toStrictEqual({
                colorSpace: "srgb",
                components: [1, 0, 0],
                alpha: 1,
            });
        });

        it("keeps hex exactly as written, including case", () => {
            expect(
                read({ colorSpace: "srgb", components: [0, 0, 1], hex: "#0000FF" }),
            ).toMatchObject({
                hex: "#0000FF",
            });
        });

        it("reads none as a component", () => {
            expect(read({ colorSpace: "hsl", components: ["none", 0, 100] })).toMatchObject({
                components: ["none", 0, 100],
            });
        });

        it.for([
            { name: "the lowest", components: [0, 0, 0] },
            { name: "the highest", components: [359.99, 100, 100] },
        ])("$name values in range", ({ components }) => {
            expect(parseColor({ colorSpace: "hsl", components }, []).ok).toBe(true);
        });

        it("reads unbounded channels at any size", () => {
            expect(parseColor({ colorSpace: "lab", components: [50, -500, 500] }, []).ok).toBe(
                true,
            );
        });

        it.for([0, 1])("reads alpha %s, at the end of its range", (alpha) => {
            expect(read({ colorSpace: "srgb", components: [0, 0, 0], alpha })).toMatchObject({
                alpha,
            });
        });
    });

    describe("references", () => {
        it.for([
            { raw: "{color.brand}", alias: "color.brand" },
            { raw: "{brand colors.primary}", alias: "brand colors.primary" },
            { raw: "{color.accent.$root}", alias: "color.accent.$root" },
        ])("reads $raw as an alias", ({ raw, alias }) => {
            expect(read(raw)).toStrictEqual({ alias });
        });

        it("reads a JSON Pointer as the whole value", () => {
            expect(read({ $ref: "#/color/brand/$value" })).toStrictEqual({
                pointer: "#/color/brand/$value",
            });
        });

        it("reads JSON Pointers in place of components, as spec example 35 does", () => {
            expect(
                read({
                    colorSpace: "srgb",
                    components: [
                        { $ref: "#/base/blue/$value/components/0" },
                        { $ref: "#/base/blue/$value/components/1" },
                        0.7,
                    ],
                    hex: "#3366b3",
                }),
            ).toStrictEqual({
                colorSpace: "srgb",
                components: [
                    { pointer: "#/base/blue/$value/components/0" },
                    { pointer: "#/base/blue/$value/components/1" },
                    0.7,
                ],
                alpha: 1,
                hex: "#3366b3",
            });
        });

        it.for(["colorSpace", "components", "alpha", "hex"])(
            "reads a JSON Pointer in place of %s",
            (part) => {
                const raw = {
                    colorSpace: "srgb",
                    components: [1, 0, 0],
                    alpha: 1,
                    hex: "#ff0000",
                    [part]: { $ref: "#/elsewhere" },
                };
                expect(read(raw)).toMatchObject({ [part]: { pointer: "#/elsewhere" } });
            },
        );

        it.for(["{}", "{color..brand}", "{color.brand", "color.brand}"])(
            "refuses %s, which is not a reference",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: { type: "color", reason: "wrong-shape", value: raw },
                    },
                ]);
            },
        );

        it("refuses a $ref with other keys beside it, and flags the $ref", () => {
            expect(details({ $ref: "#/color/brand/$value", alpha: 0.5 })).toContainEqual({
                path: ["$value", "$ref"],
                detail: { type: "color", reason: "pointer-not-alone" },
            });
        });

        it("refuses a $ref beside a whole color, even with ignoreUnknownProperties, rather than set the pointer aside", () => {
            const raw = { $ref: "#/color/brand/$value", colorSpace: "srgb", components: [1, 0, 0] };
            expect(details(raw, lenient)).toStrictEqual([
                {
                    path: ["$value", "$ref"],
                    detail: { type: "color", reason: "pointer-not-alone" },
                },
            ]);
            expect(ignored(raw, lenient)).toStrictEqual([]);
        });

        it.for(["colorSpace", "components", "alpha", "hex"])(
            "refuses a curly-brace reference as the %s, where a JSON Pointer can stand",
            (part) => {
                const raw = { colorSpace: "srgb", components: [1, 0, 0], [part]: "{color.part}" };
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value", part],
                        detail: {
                            type: "color",
                            reason: "alias-not-allowed-here",
                            reference: "{color.part}",
                        },
                    },
                ]);
            },
        );

        it("refuses a curly-brace reference in place of a component", () => {
            expect(
                details({ colorSpace: "srgb", components: ["{color.red}", 0, 0] }),
            ).toStrictEqual([
                {
                    path: ["$value", "components", 0],
                    detail: {
                        type: "color",
                        reason: "alias-not-allowed-here",
                        reference: "{color.red}",
                    },
                },
            ]);
        });
    });

    describe("with hexStringColors", () => {
        const options = { hexStringColors: true };

        it.for([
            ["#e11d48", [0.8824, 0.1137, 0.2824], 1, "#e11d48"],
            ["#E11D48", [0.8824, 0.1137, 0.2824], 1, "#E11D48"],
            ["#00000080", [0, 0, 0], 0.502, "#000000"],
        ] as const)("reads %s as the sRGB color it names", ([raw, components, alpha, hex]) => {
            expect(parseColor(raw, ["$value"], options)).toStrictEqual({
                ok: true,
                value: { colorSpace: "srgb", components, alpha, hex },
                ignored: [],
            });
        });

        it.for(["#fff", "#ffff"])("still refuses %s, which has too few digits", (raw) => {
            const result = parseColor(raw, ["$value"], options);
            expect(result.ok ? [] : result.errors.map(({ detail }) => detail)).toStrictEqual([
                { type: "color", reason: "hex-string", value: raw },
            ]);
        });
    });

    describe("refuses", () => {
        it.for(["#e11d48", "#E11D48", "#00000080", "#fff", "#ffff"])(
            "the hex string %s, which the Color module no longer allows",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: { type: "color", reason: "hex-string", value: raw },
                    },
                ]);
            },
        );

        it.for(["#e11d4", "red", 42, null, [1, 0, 0], true])("%j, which is not a color", (raw) => {
            expect(details(raw)).toStrictEqual([
                { path: ["$value"], detail: { type: "color", reason: "wrong-shape", value: raw } },
            ]);
        });

        it("a color with no colorSpace or components", () => {
            expect(details({})).toStrictEqual([
                {
                    path: ["$value", "colorSpace"],
                    detail: { type: "color", reason: "missing-property", property: "colorSpace" },
                },
                {
                    path: ["$value", "components"],
                    detail: { type: "color", reason: "missing-property", property: "components" },
                },
            ]);
        });

        it.for(["rgb", "sRGB"])(
            "the color space %s, which the spec does not define",
            (colorSpace) => {
                expect(details({ colorSpace, components: [1, 0, 0] })).toStrictEqual([
                    {
                        path: ["$value", "colorSpace"],
                        detail: { type: "color", reason: "unknown-color-space", value: colorSpace },
                    },
                ]);
            },
        );

        it.for([[1, 0], [1, 0, 0, 1], "1 0 0"])(
            "components %j, which are not three",
            (components) => {
                expect(details({ colorSpace: "srgb", components })).toStrictEqual([
                    {
                        path: ["$value", "components"],
                        detail: {
                            type: "color",
                            reason: "not-three-components",
                            value: components,
                        },
                    },
                ]);
            },
        );

        it("a component that is not a number or none", () => {
            expect(details({ colorSpace: "srgb", components: [1, "0", null] })).toStrictEqual([
                {
                    path: ["$value", "components", 1],
                    detail: { type: "color", reason: "component-not-a-number", value: "0" },
                },
                {
                    path: ["$value", "components", 2],
                    detail: { type: "color", reason: "component-not-a-number", value: null },
                },
            ]);
        });

        it.for([
            {
                name: "sRGB red above 1",
                colorSpace: "srgb",
                components: [1.1, 0, 0],
                index: 0,
                channel: { component: "R", min: 0, max: 1, maxExclusive: false },
            },
            {
                name: "sRGB green below 0",
                colorSpace: "srgb",
                components: [0, -0.1, 0],
                index: 1,
                channel: { component: "G", min: 0, max: 1, maxExclusive: false },
            },
            {
                name: "HSL hue of 360",
                colorSpace: "hsl",
                components: [360, 50, 50],
                index: 0,
                channel: { component: "H", min: 0, max: 360, maxExclusive: true },
            },
            {
                name: "HSL saturation above 100",
                colorSpace: "hsl",
                components: [0, 101, 50],
                index: 1,
                channel: { component: "S", min: 0, max: 100, maxExclusive: false },
            },
            {
                name: "OKLCH chroma below 0, with no upper limit to report",
                colorSpace: "oklch",
                components: [0.5, -0.1, 0],
                index: 1,
                channel: { component: "C", min: 0, maxExclusive: false },
            },
            {
                name: "OKLCH hue of 360",
                colorSpace: "oklch",
                components: [0.5, 0.1, 360],
                index: 2,
                channel: { component: "H", min: 0, max: 360, maxExclusive: true },
            },
            {
                name: "CIELAB lightness above 100",
                colorSpace: "lab",
                components: [101, 0, 0],
                index: 0,
                channel: { component: "L", min: 0, max: 100, maxExclusive: false },
            },
        ])("$name, which is out of range", ({ colorSpace, components, index, channel }) => {
            expect(details({ colorSpace, components })).toStrictEqual([
                {
                    path: ["$value", "components", index],
                    detail: {
                        type: "color",
                        reason: "component-out-of-range",
                        value: components[index],
                        colorSpace,
                        ...channel,
                    },
                },
            ]);
        });

        it.for([
            { alpha: 1.5, reason: "alpha-out-of-range" },
            { alpha: -0.1, reason: "alpha-out-of-range" },
            { alpha: "0.5", reason: "not-a-number" },
        ])("alpha $alpha", ({ alpha, reason }) => {
            expect(details({ colorSpace: "srgb", components: [0, 0, 0], alpha })).toStrictEqual([
                { path: ["$value", "alpha"], detail: { type: "color", reason, value: alpha } },
            ]);
        });

        it.for(["#00000080", "ff0000", "#gg0000", 16711680])(
            "hex %j, which is not six-digit CSS hex",
            (hex) => {
                expect(details({ colorSpace: "srgb", components: [1, 0, 0], hex })).toStrictEqual([
                    {
                        path: ["$value", "hex"],
                        detail: { type: "color", reason: "hex-not-six-digits", value: hex },
                    },
                ]);
            },
        );

        it("a three-digit hex, giving it with six digits", () => {
            expect(
                details({ colorSpace: "srgb", components: [1, 0, 0], hex: "#F0a" }),
            ).toStrictEqual([
                {
                    path: ["$value", "hex"],
                    detail: {
                        type: "color",
                        reason: "hex-not-six-digits",
                        value: "#F0a",
                        sixDigits: "#FF00aa",
                    },
                },
            ]);
        });

        it("every problem in one go", () => {
            expect(
                details({ colorSpace: "cmyk", components: [1, 0], alpha: 2, hex: "#fff" }),
            ).toStrictEqual([
                {
                    path: ["$value", "colorSpace"],
                    detail: { type: "color", reason: "unknown-color-space", value: "cmyk" },
                },
                {
                    path: ["$value", "components"],
                    detail: { type: "color", reason: "not-three-components", value: [1, 0] },
                },
                {
                    path: ["$value", "alpha"],
                    detail: { type: "color", reason: "alpha-out-of-range", value: 2 },
                },
                {
                    path: ["$value", "hex"],
                    detail: {
                        type: "color",
                        reason: "hex-not-six-digits",
                        value: "#fff",
                        sixDigits: "#ffffff",
                    },
                },
            ]);
        });
    });

    describe("a property its type does not define", () => {
        it("makes the value invalid by default, as Format 9.2 says of a composite", () => {
            const raw = { colorSpace: "srgb", components: [1, 0, 0], opacity: 1 };
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value", "opacity"],
                    detail: { type: "color", reason: "unknown-property", property: "opacity" },
                },
            ]);
            expect(ignored(raw)).toStrictEqual([]);
        });

        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a property the Color module does not define", () => {
                const raw = { colorSpace: "srgb", components: [1, 0, 0], opacity: 1 };
                expect(read(raw, lenient)).toStrictEqual(
                    read({ colorSpace: "srgb", components: [1, 0, 0] }, lenient),
                );
                expect(ignored(raw, lenient)).toStrictEqual([
                    { path: ["$value", "opacity"], detail: { type: "color", property: "opacity" } },
                ]);
            });
        });
    });
});
