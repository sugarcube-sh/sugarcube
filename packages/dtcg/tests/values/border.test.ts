import { describe, expect, it } from "vitest";
import { parsing } from "./parsing.js";

const { read, reasons, refuses } = parsing("border");

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
            const raw = {
                color: "#ff0000",
                width: "1px",
                style: { dashArray: [{ value: 1, unit: "em" }], lineCap: "round" },
            };
            expect(reasons(raw)).toStrictEqual([
                [["$value", "color"], "color", "hex-string"],
                [["$value", "width"], "dimension", "string-with-unit"],
                [["$value", "style", "dashArray", 0, "unit"], "dimension", "unit-not-allowed"],
            ]);
        });
    });
});
