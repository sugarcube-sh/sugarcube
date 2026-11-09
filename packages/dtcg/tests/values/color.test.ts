import { describe, expect, it } from "vitest";
import { lenient, parsing } from "./parsing.js";

const { read, details, ignored, reasons, refuses } = parsing("color");

const asObjects: Record<string, unknown> = {
    "#e11d48": { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], hex: "#e11d48" },
    "#E11D48": { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], hex: "#E11D48" },
    "#00000080": { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.502, hex: "#000000" },
    "#fff": { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" },
    "#ffff": { colorSpace: "srgb", components: [1, 1, 1], alpha: 1, hex: "#ffffff" },
};

describe("parseValue, color", () => {
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
            const blue = { colorSpace: "srgb", components: [0, 0, 1], hex: "#0000FF" };
            expect(read(blue)).toMatchObject({ hex: "#0000FF" });
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
            read({ colorSpace: "hsl", components });
        });

        it("reads unbounded channels at any size", () => {
            read({ colorSpace: "lab", components: [50, -500, 500] });
        });

        it.for([0, 1])("reads alpha %s, at the end of its range", (alpha) => {
            expect(read({ colorSpace: "srgb", components: [0, 0, 0], alpha })).toMatchObject({
                alpha,
            });
        });
    });

    describe("references", () => {
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
                    { syntax: "json-pointer", pointer: "#/base/blue/$value/components/0" },
                    { syntax: "json-pointer", pointer: "#/base/blue/$value/components/1" },
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
                expect(read(raw)).toMatchObject({
                    [part]: { syntax: "json-pointer", pointer: "#/elsewhere" },
                });
            },
        );

        it("refuses a $ref with other keys beside it, and flags the $ref", () => {
            expect(details({ $ref: "#/color/brand/$value", alpha: 0.5 })).toContainEqual({
                jsonPath: ["$value", "$ref"],
                detail: { type: "color", reason: "pointer-not-alone" },
            });
        });

        it("refuses a $ref beside a whole color, even with ignoreUnknownProperties, rather than set the pointer aside", () => {
            const raw = { $ref: "#/color/brand/$value", colorSpace: "srgb", components: [1, 0, 0] };
            refuses(raw, ["$ref"], { reason: "pointer-not-alone" }, lenient);
            expect(ignored(raw, lenient)).toStrictEqual([]);
        });

        it.for(["colorSpace", "components", "alpha", "hex"])(
            "refuses a curly-brace reference as the %s, where a JSON Pointer can stand",
            (part) => {
                const raw = { colorSpace: "srgb", components: [1, 0, 0], [part]: "{color.part}" };
                refuses(raw, [part], {
                    reason: "curly-brace-not-allowed-here",
                    reference: "{color.part}",
                });
            },
        );

        it("refuses a curly-brace reference in place of a component", () => {
            refuses({ colorSpace: "srgb", components: ["{color.red}", 0, 0] }, ["components", 0], {
                reason: "curly-brace-not-allowed-here",
                reference: "{color.red}",
            });
        });
    });

    describe("with hexStringColors", () => {
        const options = { hexStringColors: true };

        it.for([
            ["#e11d48", [225 / 255, 29 / 255, 72 / 255], 1, "#e11d48"],
            ["#E11D48", [225 / 255, 29 / 255, 72 / 255], 1, "#E11D48"],
            ["#00000080", [0, 0, 0], 128 / 255, "#000000"],
        ] as const)(
            "reads %s as the sRGB color it names, exactly",
            ([raw, components, alpha, hex]) => {
                expect(read(raw, options)).toStrictEqual({
                    colorSpace: "srgb",
                    components,
                    alpha,
                    hex,
                });
                expect(ignored(raw, options)).toStrictEqual([]);
            },
        );

        it.for([
            ["#fff", "#ffffff"],
            ["#F0a", "#FF00aa"],
            ["#0008", "#00000088"],
        ])(
            "refuses %s, which has too few digits, giving the %s it stands for",
            ([raw, expanded]) => {
                refuses(raw, [], { reason: "short-hex-string", value: raw, expanded }, options);
            },
        );
    });

    describe("refuses", () => {
        it.for(["#e11d48", "#E11D48", "#00000080", "#fff", "#ffff"])(
            "the hex string %s, which the Color module no longer allows, giving the object it stands for",
            (raw) => {
                refuses(raw, [], { reason: "hex-string", value: raw, asObject: asObjects[raw] });
            },
        );

        it.for([
            ["#e11d4", "a hex string five digits long"],
            [42, "a number"],
            [null, "null"],
            [[1, 0, 0], "components with no colorSpace"],
            [true, "a boolean"],
            ["{}", "braces with no path"],
            ["{color..brand}", "a path with an empty name in it"],
            ["color.brand}", "a path with no opening brace"],
        ] as const)("%j, which is %s, not a color", ([raw]) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });

        it("a color with no colorSpace or components", () => {
            expect(details({})).toStrictEqual([
                {
                    jsonPath: ["$value", "colorSpace"],
                    detail: { type: "color", reason: "missing-property", property: "colorSpace" },
                },
                {
                    jsonPath: ["$value", "components"],
                    detail: { type: "color", reason: "missing-property", property: "components" },
                },
            ]);
        });

        it.for(["rgb", "sRGB"])(
            "the color space %s, which the spec does not define",
            (colorSpace) => {
                refuses({ colorSpace, components: [1, 0, 0] }, ["colorSpace"], {
                    reason: "unknown-color-space",
                    value: colorSpace,
                });
            },
        );

        it.for([[1, 0], [1, 0, 0, 1], "1 0 0"])(
            "components %j, which are not three",
            (components) => {
                refuses({ colorSpace: "srgb", components }, ["components"], {
                    reason: "not-three-components",
                    value: components,
                });
            },
        );

        it("a component that is not a number or none", () => {
            expect(details({ colorSpace: "srgb", components: [1, "0", null] })).toStrictEqual([
                {
                    jsonPath: ["$value", "components", 1],
                    detail: { type: "color", reason: "component-not-a-number", value: "0" },
                },
                {
                    jsonPath: ["$value", "components", 2],
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
            refuses({ colorSpace, components }, ["components", index], {
                reason: "component-out-of-range",
                value: components[index],
                colorSpace,
                ...channel,
            });
        });

        it.for([
            { alpha: 1.5, reason: "alpha-out-of-range" },
            { alpha: -0.1, reason: "alpha-out-of-range" },
            { alpha: "0.5", reason: "not-a-number" },
        ])("alpha $alpha", ({ alpha, reason }) => {
            refuses({ colorSpace: "srgb", components: [0, 0, 0], alpha }, ["alpha"], {
                reason,
                value: alpha,
            });
        });

        it.for(["#00000080", "ff0000", "#gg0000", 16711680])(
            "hex %j, which is not six-digit CSS hex",
            (hex) => {
                refuses({ colorSpace: "srgb", components: [1, 0, 0], hex }, ["hex"], {
                    reason: "hex-not-six-digits",
                    value: hex,
                });
            },
        );

        it("a three-digit hex, giving it with six digits", () => {
            refuses({ colorSpace: "srgb", components: [1, 0, 0], hex: "#F0a" }, ["hex"], {
                reason: "hex-not-six-digits",
                value: "#F0a",
                sixDigits: "#FF00aa",
            });
        });

        it("every problem in one go", () => {
            const raw = { colorSpace: "cmyk", components: [1, 0], alpha: 2, hex: "#fff" };
            expect(reasons(raw)).toStrictEqual([
                [["$value", "colorSpace"], "color", "unknown-color-space"],
                [["$value", "components"], "color", "not-three-components"],
                [["$value", "alpha"], "color", "alpha-out-of-range"],
                [["$value", "hex"], "color", "hex-not-six-digits"],
            ]);
        });
    });
});
