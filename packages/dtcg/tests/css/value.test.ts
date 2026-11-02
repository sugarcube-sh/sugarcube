import { describe, expect, it } from "vitest";
import { type CSSValueOptions, toCSSValue, toCustomPropertyName } from "../../src/css.js";
import { type Token, readFromMemory } from "../../src/index.js";

const px = (value: number) => ({ value, unit: "px" });
const color = (value: unknown) => ({ $type: "color", $value: value });

function read(json: Record<string, unknown>): (path: string) => Token {
    const tokens = readFromMemory(
        { files: { "tokens.json": JSON.stringify(json) } },
        { hexStringColors: true },
    );
    return (path) => {
        const found = tokens.getPermutation().getToken(path);
        if (!found) throw new Error(`no token at ${path}`);
        return found;
    };
}

const asVariables: CSSValueOptions = {
    replacement: (ref, cssProperty) =>
        ref.pointsToToken
            ? { customProperty: toCustomPropertyName(ref.pointsToToken.path, { cssProperty }) }
            : undefined,
};

describe("cssValue", () => {
    it("writes a color read from a hex string as that string, however it is reached", () => {
        const at = read({
            plain: color("#e11d48"),
            scrim: color("#00000080"),
            loud: color("#0000FFCC"),
            alias: color("{loud}"),
            start: { $type: "gradient", $value: [{ color: "#ffffff", position: 0 }] },
            fade: { $type: "gradient", $value: ["{start}", { color: "{plain}", position: 1 }] },
        });
        expect(
            ["plain", "scrim", "loud", "alias", "fade"].map((path) => toCSSValue(at(path))),
        ).toStrictEqual([
            "#e11d48",
            "#00000080",
            "#0000FFCC",
            "#0000FFCC",
            "#ffffff 0%, #e11d48 100%",
        ]);
        expect(toCSSValue(at("scrim"), { colors: "hex" })).toBe("#00000080");
    });

    it("writes an sRGB color object from its components, to four places, whatever its hex says", () => {
        const at = read({
            exact: color({ colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" }),
            converted: color({
                colorSpace: "srgb",
                components: [0.8824, 0.1137, 0.2824],
                hex: "#e11d48",
            }),
            stale: color({ colorSpace: "srgb", components: [1, 0, 0], hex: "#00ff00" }),
            grey: color({ colorSpace: "srgb", components: [0.5, 0.5, 0.5] }),
            faint: color({
                colorSpace: "srgb",
                components: [0, 0, 0],
                alpha: 0.15,
                hex: "#000000",
            }),
        });
        expect(
            ["exact", "converted", "stale", "grey", "faint"].map((path) => toCSSValue(at(path))),
        ).toStrictEqual([
            "rgb(255 0 0)",
            "rgb(225.01 28.99 72.01)",
            "rgb(255 0 0)",
            "rgb(127.5 127.5 127.5)",
            "rgb(0 0 0 / 0.15)",
        ]);
        expect(toCSSValue(at("stale"), { colors: "hex" })).toBe("#00ff00");
        expect(toCSSValue(at("faint"), { colors: "hex" })).toBe("#00000026");
    });

    it("writes a color object from its components without hexStringColors too", () => {
        const strict = readFromMemory({
            files: {
                "tokens.json": JSON.stringify({
                    exact: color({ colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" }),
                }),
            },
        });
        const exact = strict.getPermutation().getToken("exact");
        expect(exact && toCSSValue(exact)).toBe("rgb(255 0 0)");
    });

    it("writes every color space the DTCG Color module defines", () => {
        const space = (colorSpace: string, components: unknown[], alpha?: number) =>
            color({ colorSpace, components, ...(alpha !== undefined && { alpha }) });
        const written = {
            "linear": [space("srgb-linear", [0.2, 0.5, 0.75]), "color(srgb-linear 0.2 0.5 0.75)"],
            "hsl": [space("hsl", [270, 80, 60]), "hsl(270 80% 60%)"],
            "hsl-fraction": [
                space("hsl", [210.123456, 50.5, 40.12345]),
                "hsl(210.1235 50.5% 40.1235%)",
            ],
            "hwb": [space("hwb", [200, 12.5, 30]), "hwb(200 12.5% 30%)"],
            "hwb-none": [space("hwb", [200, "none", 30]), "hwb(200 none 30%)"],
            "hwb-fraction": [
                space("hwb", [200.123456, 12.34567, 30.00004]),
                "hwb(200.1235 12.3457% 30%)",
            ],
            "lab": [space("lab", [52.2345, 40.12345, -60.5]), "lab(52.2345 40.1235 -60.5)"],
            "lch": [space("lch", [52.2, 72.9, 303.45678]), "lch(52.2 72.9 303.4568)"],
            "oklab": [space("oklab", [0.62, 0.11, -0.153]), "oklab(0.62 0.11 -0.153)"],
            "oklch": [
                space("oklch", [0.628, 0.2577, 29.23], 0.8),
                "oklch(0.628 0.2577 29.23 / 0.8)",
            ],
            "p3": [space("display-p3", [0.9, 0.2, 0.1]), "color(display-p3 0.9 0.2 0.1)"],
            "a98": [space("a98-rgb", [0.5, 0.25, 1]), "color(a98-rgb 0.5 0.25 1)"],
            "prophoto": [space("prophoto-rgb", [0.4, 0.3, 0.2]), "color(prophoto-rgb 0.4 0.3 0.2)"],
            "rec2020": [space("rec2020", [0.1, 0.9, 0.3]), "color(rec2020 0.1 0.9 0.3)"],
            "xyz-d65": [
                space("xyz-d65", [0.25, 0.4, 0.1], 0.5),
                "color(xyz-d65 0.25 0.4 0.1 / 0.5)",
            ],
            "xyz-d50": [space("xyz-d50", [0.3, 0.3, 0.3]), "color(xyz-d50 0.3 0.3 0.3)"],
        };
        const at = read(Object.fromEntries(Object.entries(written).map(([k, [t]]) => [k, t])));
        for (const [path, [, css]] of Object.entries(written)) {
            expect(toCSSValue(at(path)), path).toBe(css);
        }
    });

    it("writes each color as its hex, when asked, for a browser that cannot show its space", () => {
        const at = read({
            oklch: color({
                colorSpace: "oklch",
                components: [0.7, 0.3, 328],
                alpha: 0.8,
                hex: "#ff00ff",
            }),
            p3: color({ colorSpace: "display-p3", components: [0.1, 0.1, 0.12], hex: "#1a1a1f" }),
            none: color({ colorSpace: "lab", components: [50, 20, -30] }),
            edge: {
                $type: "border",
                $value: {
                    color: { colorSpace: "oklch", components: [0.5, 0.1, 20], hex: "#aa3344" },
                    width: px(1),
                    style: "solid",
                },
            },
        });
        const hex = { colors: "hex" } as const;
        expect(toCSSValue(at("oklch"), hex)).toBe("#ff00ffcc");
        expect(toCSSValue(at("p3"), hex)).toBe("#1a1a1f");
        expect(toCSSValue(at("none"), hex)).toBe("lab(50 20 -30)");
        expect(toCSSValue(at("edge"), hex)).toBe("1px solid #aa3344");
        expect(toCSSValue(at("oklch"))).toBe("oklch(0.7 0.3 328 / 0.8)");
    });

    it("gives undefined for a token that isn't there, so a missing path needs no check first", () => {
        const at = readFromMemory({
            files: { "tokens.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }) },
        }).getPermutation();
        expect(toCSSValue(at.getToken("nope"))).toBeUndefined();
        expect(toCSSValue(at.getToken("gap"))).toBe("1");
    });

    it("writes the other simple types as CSS writes them", () => {
        const at = read({
            size: { $type: "dimension", $value: { value: 1.5, unit: "rem" } },
            fast: { $type: "duration", $value: { value: 200, unit: "ms" } },
            ease: { $type: "cubicBezier", $value: [0.42, 0, 0.58, 1] },
            ratio: { $type: "number", $value: 1.5 },
            bold: { $type: "fontWeight", $value: "bold" },
            solid: { $type: "strokeStyle", $value: "solid" },
        });
        expect(
            ["size", "fast", "ease", "ratio", "bold", "solid"].map((p) => toCSSValue(at(p))),
        ).toStrictEqual([
            "1.5rem",
            "200ms",
            "cubic-bezier(0.42, 0, 0.58, 1)",
            "1.5",
            "700",
            "solid",
        ]);
    });

    it("writes a reference as its resolved value, or as the replacement given for it", () => {
        const at = read({
            ink: color("#111111"),
            hairline: { $type: "dimension", $value: px(1) },
            edge: {
                $type: "border",
                $value: { color: "{ink}", width: "{hairline}", style: "solid" },
            },
            brand: color("{ink}"),
        });
        expect(toCSSValue(at("edge"))).toBe("1px solid #111111");
        expect(toCSSValue(at("edge"), asVariables)).toBe("var(--hairline) solid var(--ink)");
        expect(toCSSValue(at("brand"), asVariables)).toBe("var(--ink)");
        expect(
            toCSSValue(at("edge"), {
                replacement: (ref) =>
                    ref.pointsToPath === "hairline" ? { css: "thin" } : undefined,
            }),
        ).toBe("thin solid #111111");
    });

    it("writes a JSON Pointer to a whole value as its replacement, and one inside a part as the value it reaches", () => {
        const at = read({
            deep: color({ colorSpace: "srgb", components: [0.2, 0, 0] }),
            edge: {
                $type: "border",
                $value: { color: { $ref: "#/deep/$value" }, width: px(2), style: "dashed" },
            },
            tint: color({
                colorSpace: "srgb",
                components: [{ $ref: "#/deep/$value/components/0" }, 1, 1],
            }),
        });
        expect(toCSSValue(at("edge"), asVariables)).toBe("2px dashed var(--deep)");
        expect(toCSSValue(at("edge"))).toBe("2px dashed rgb(51 0 0)");
        expect(toCSSValue(at("tint"), asVariables)).toBe("rgb(51 255 255)");
    });

    it("writes a dash pattern as dashed, since CSS cannot draw one (Format 9.3.3)", () => {
        const at = read({
            dots: { $type: "strokeStyle", $value: { dashArray: [px(1), px(2)], lineCap: "round" } },
            edge: {
                $type: "border",
                $value: {
                    color: "#111111",
                    width: px(2),
                    style: { dashArray: [px(4)], lineCap: "butt" },
                },
            },
        });
        expect(toCSSValue(at("dots"))).toBe("dashed");
        expect(toCSSValue(at("edge"))).toBe("2px dashed #111111");
    });

    it("writes a shadow's layers, a layer referring to a whole shadow token as its replacement", () => {
        const at = read({
            lift: {
                $type: "shadow",
                $value: {
                    color: "#000000",
                    offsetX: px(0),
                    offsetY: px(1),
                    blur: px(2),
                    spread: px(0),
                },
            },
            stack: {
                $type: "shadow",
                $value: [
                    "{lift}",
                    {
                        color: "#000000",
                        offsetX: px(0),
                        offsetY: px(4),
                        blur: px(8),
                        spread: px(0),
                        inset: true,
                    },
                ],
            },
        });
        expect(toCSSValue(at("stack"))).toBe(
            "0px 1px 2px 0px #000000, inset 0px 4px 8px 0px #000000",
        );
        expect(toCSSValue(at("stack"), asVariables)).toBe(
            "var(--lift), inset 0px 4px 8px 0px #000000",
        );
    });

    it("writes a gradient as its stops, positions as percentages without float drift", () => {
        const at = read({
            half: { $type: "number", $value: 0.5 },
            start: { $type: "gradient", $value: [{ color: "#ffffff", position: 0 }] },
            third: {
                $type: "gradient",
                $value: [
                    { color: "#ffffff", position: 0.3 },
                    { color: "#000000", position: 0.57 },
                ],
            },
            fade: {
                $type: "gradient",
                $value: ["{start}", { color: "#e11d48", position: "{half}" }],
            },
        });
        expect(toCSSValue(at("third"))).toBe("#ffffff 30%, #000000 57%");
        expect(toCSSValue(at("fade"), asVariables)).toBe(
            "#ffffff 0%, #e11d48 clamp(0%, var(--half) * 100%, 100%)",
        );
    });

    it("quotes a font name where CSS needs it, and leaves vendor and generic names bare", () => {
        const at = read({
            stack: {
                $type: "fontFamily",
                $value: [
                    "Inter",
                    "-apple-system",
                    "1Password",
                    "inherit",
                    'Say "hi"',
                    "back\\slash",
                    "Sans-Serif",
                    "ui-monospace",
                ],
            },
        });
        expect(toCSSValue(at("stack"))).toBe(
            'Inter, -apple-system, "1Password", "inherit", "Say \\"hi\\"", "back\\\\slash", Sans-Serif, ui-monospace',
        );
    });

    describe("writes typography as a value for each CSS property it sets", () => {
        const at = read({
            hairline: { $type: "dimension", $value: px(1) },
            body: {
                $type: "typography",
                $value: {
                    fontFamily: ["Inter", "sans-serif"],
                    fontSize: "{hairline}",
                    fontWeight: 400,
                    letterSpacing: px(0),
                    lineHeight: 0,
                },
            },
            quote: { $type: "typography", $value: "{body}" },
        });

        it("in the order the properties are listed", () => {
            const body = at("body");
            if (body.type !== "typography") throw new Error("body is typography");
            const css = toCSSValue(body, asVariables);
            expect(css).toStrictEqual({
                "font-family": "Inter, sans-serif",
                "font-size": "var(--hairline)",
                "font-weight": "400",
                "letter-spacing": "0px",
                "line-height": "0",
            });
            expect(Object.keys(css ?? {})).toStrictEqual([
                "font-family",
                "font-size",
                "font-weight",
                "letter-spacing",
                "line-height",
            ]);
        });

        it("each property a custom property of its own when the whole value is a reference", () => {
            expect(toCSSValue(at("quote"), asVariables)).toStrictEqual({
                "font-family": "var(--body-font-family)",
                "font-size": "var(--body-font-size)",
                "font-weight": "var(--body-font-weight)",
                "letter-spacing": "var(--body-letter-spacing)",
                "line-height": "var(--body-line-height)",
            });
        });

        it("asking for each CSS property's custom property, so a caller's naming decides how it is joined", () => {
            const asked: (string | undefined)[] = [];
            const css = toCSSValue(at("quote"), {
                replacement: (ref, cssProperty) => {
                    asked.push(cssProperty);
                    return ref.pointsToToken
                        ? {
                              customProperty: toCustomPropertyName(ref.pointsToToken.path, {
                                  delimiter: "_",
                                  cssProperty,
                              }),
                          }
                        : undefined;
                },
            });
            expect(css).toStrictEqual({
                "font-family": "var(--body_font-family)",
                "font-size": "var(--body_font-size)",
                "font-weight": "var(--body_font-weight)",
                "letter-spacing": "var(--body_letter-spacing)",
                "line-height": "var(--body_line-height)",
            });
            expect(asked).toStrictEqual([
                "font-family",
                "font-size",
                "font-weight",
                "letter-spacing",
                "line-height",
            ]);
        });
    });

    it("writes a part of a value on its own, such as a border's color for a swatch", () => {
        const at = read({
            edge: { $type: "border", $value: { color: "#e11d48", width: px(1), style: "solid" } },
        });
        const border = at("edge").parts;
        if (border?.type !== "border") throw new Error("edge is a border");
        expect(toCSSValue(border.color)).toBe("#e11d48");
        expect(toCSSValue(border.width)).toBe("1px");
    });

    it("gives nothing for a token with no resolved value", () => {
        const at = read({ lost: color("{missing}") });
        expect(toCSSValue(at("lost"))).toBeUndefined();
    });
});
