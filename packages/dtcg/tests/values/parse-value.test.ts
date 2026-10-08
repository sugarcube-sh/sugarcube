import { describe, expect, it } from "vitest";
import { parseValue } from "../../src/values.js";

describe("parseValue", () => {
    it("reads a value of the type it is given, references allowed", () => {
        expect(parseValue("number", 1.5, [])).toStrictEqual({ ok: true, value: 1.5, ignored: [] });
        expect(parseValue("number", "{ratio.golden}", [])).toStrictEqual({
            ok: true,
            value: { alias: "ratio.golden" },
            ignored: [],
        });
    });

    it("reports a value that does not fit the type, as that type's parser does", () => {
        const read = parseValue("dimension", "16px", ["base"], { references: false });
        expect(read.ok ? [] : read.errors.map(({ path, detail }) => ({ path, detail }))).toEqual([
            {
                path: ["base"],
                detail: {
                    type: "dimension",
                    reason: "string-with-unit",
                    value: "16px",
                    asObject: { value: 16, unit: "px" },
                },
            },
        ]);
    });

    it("reads a literal value, when only literals are wanted", () => {
        expect(
            parseValue("dimension", { value: 1, unit: "rem" }, [], { references: false }),
        ).toStrictEqual({ ok: true, value: { value: 1, unit: "rem" }, ignored: [] });
    });

    it.for([
        { written: "{ratio.golden}", at: [], reference: "{ratio.golden}" },
        { written: { $ref: "#/ratio/golden/$value" }, at: [], reference: "#/ratio/golden/$value" },
    ])(
        "refuses $written in place of a whole value, when only literals are wanted",
        ({ written, at, reference }) => {
            const read = parseValue("number", written, ["ratio"], { references: false });
            expect(
                read.ok ? [] : read.errors.map(({ path, detail }) => ({ path, detail })),
            ).toEqual([
                {
                    path: ["ratio", ...at],
                    detail: {
                        type: "number",
                        reason: "reference-not-allowed",
                        reference: reference,
                    },
                },
            ]);
        },
    );

    it("refuses a pointer in place of part of a value, where it is written", () => {
        const read = parseValue(
            "dimension",
            { value: { $ref: "#/size/base/$value/value" }, unit: "rem" },
            ["base", "min"],
            { references: false },
        );
        expect(read.ok ? [] : read.errors.map(({ path, detail }) => ({ path, detail }))).toEqual([
            {
                path: ["base", "min", "value"],
                detail: {
                    type: "dimension",
                    reason: "reference-not-allowed",
                    reference: "#/size/base/$value/value",
                },
            },
        ]);
    });

    it("refuses a reference in a single shadow at the path written, not the list it is read into", () => {
        const shadow = {
            color: "{color.shadow}",
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 1, unit: "px" },
            blur: { value: 2, unit: "px" },
            spread: { value: 0, unit: "px" },
        };
        const read = parseValue("shadow", shadow, [], { references: false });
        expect(read.ok ? [] : read.errors.map(({ path, detail }) => ({ path, detail }))).toEqual([
            {
                path: ["color"],
                detail: {
                    type: "shadow",
                    reason: "reference-not-allowed",
                    reference: "{color.shadow}",
                },
            },
        ]);
    });

    it("reads a hex string in place of a color inside a composite, with hexStringColors", () => {
        const stop = (color: string, position: number) => ({ color, position });
        const result = parseValue("gradient", [stop("#000000", 0), stop("#ffffff80", 1)], [], {
            hexStringColors: true,
            references: false,
        });
        expect(result.ok && result.value.map(({ color }) => color)).toStrictEqual([
            { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
            { colorSpace: "srgb", components: [1, 1, 1], alpha: 0.502, hex: "#ffffff" },
        ]);
    });
});
