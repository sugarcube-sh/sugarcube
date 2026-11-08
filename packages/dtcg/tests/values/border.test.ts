import { describe, expect, it } from "vitest";
import { lenient, parsing } from "./parsing.js";

const { read, details, ignored, refuses } = parsing("border");

const color = { colorSpace: "srgb", components: [0.218, 0.218, 0.218] };
const width = { value: 3, unit: "px" };

describe("parseValue, border", () => {
    describe("reads", () => {
        it("the heavy border from spec example 52, in each part's own shape", () => {
            expect(read({ color, width, style: "solid" })).toStrictEqual({
                color: { ...color, alpha: 1 },
                width,
                style: { kind: "keyword", keyword: "solid" },
            });
        });

        it("the focus ring from spec example 52: a reference for the color and a dash pattern", () => {
            expect(
                read({
                    color: "{color.focusring}",
                    width: { value: 1, unit: "px" },
                    style: {
                        dashArray: [
                            { value: 0.5, unit: "rem" },
                            { value: 0.25, unit: "rem" },
                        ],
                        lineCap: "round",
                    },
                }),
            ).toStrictEqual({
                color: { syntax: "curly-brace", path: "color.focusring" },
                width: { value: 1, unit: "px" },
                style: {
                    kind: "dash",
                    dashArray: [
                        { value: 0.5, unit: "rem" },
                        { value: 0.25, unit: "rem" },
                    ],
                    lineCap: "round",
                },
            });
        });

        it.for(["color", "width", "style"])("a reference in place of %s", (part) => {
            const raw = { color, width, style: "solid", [part]: `{border.${part}}` };
            expect(read(raw)).toMatchObject({
                [part]: { syntax: "curly-brace", path: `border.${part}` },
            });
        });

        it("reads a reference to a whole token in curly brace syntax", () => {
            expect(read("{border.heavy}")).toStrictEqual({
                syntax: "curly-brace",
                path: "border.heavy",
            });
        });

        it("reads a JSON Pointer as the whole value", () => {
            expect(read({ $ref: "#/border/heavy/$value" })).toStrictEqual({
                syntax: "json-pointer",
                pointer: "#/border/heavy/$value",
            });
        });
    });

    describe("refuses", () => {
        it.for(["1px solid red", 1, null, [color, width, "solid"]])(
            "%j, which is not a border",
            (raw) => {
                refuses(raw, [], { reason: "wrong-shape", value: raw });
            },
        );

        it.for(["color", "width", "style"])(
            "a border with no %s, since spec 9.4 requires all three",
            (part) => {
                const raw: Record<string, unknown> = { color, width, style: "solid" };
                delete raw[part];
                refuses(raw, [part], { reason: "missing-property", property: part });
            },
        );

        it("each bad part, with its own parser's reason, at its full path", () => {
            expect(
                details({
                    color: "#ff0000",
                    width: "1px",
                    style: { dashArray: [{ value: 1, unit: "em" }], lineCap: "round" },
                }),
            ).toStrictEqual([
                {
                    jsonPath: ["$value", "color"],
                    detail: {
                        type: "color",
                        reason: "hex-string",
                        value: "#ff0000",
                        asObject: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
                    },
                },
                {
                    jsonPath: ["$value", "width"],
                    detail: {
                        type: "dimension",
                        reason: "string-with-unit",
                        value: "1px",
                        asObject: { value: 1, unit: "px" },
                    },
                },
                {
                    jsonPath: ["$value", "style", "dashArray", 0, "unit"],
                    detail: {
                        type: "dimension",
                        reason: "unit-not-allowed",
                        unit: "em",
                        allowed: ["px", "rem"],
                    },
                },
            ]);
        });
    });

    describe("a property its type does not define", () => {
        it("makes the value invalid by default, as Format 9.2 says of a composite", () => {
            const raw = { color, width, style: "solid", radius: width };
            refuses(raw, ["radius"], { reason: "unknown-property", property: "radius" });
            expect(ignored(raw)).toStrictEqual([]);
        });

        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a part that spec 9.2 does not define", () => {
                const raw = { color, width, style: "solid", radius: width };
                expect(read(raw, lenient)).toStrictEqual(
                    read({ color, width, style: "solid" }, lenient),
                );
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", "radius"],
                        detail: { type: "border", property: "radius" },
                    },
                ]);
            });
        });
    });
});
