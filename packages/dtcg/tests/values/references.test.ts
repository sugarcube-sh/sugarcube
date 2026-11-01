import { describe, expect, it } from "vitest";
import { isReference } from "../../src/index.js";
import { parseReference, parseValue, referenceText, toJsonPointer } from "../../src/values.js";

describe("isReference", () => {
    it("recognises the references a parser reads, in either syntax", () => {
        const curly = parseValue("number", "{ratio.golden}", []);
        const pointer = parseValue("number", { $ref: "#/ratio/golden/$value" }, []);
        expect(curly.ok && isReference(curly.value)).toBe(true);
        expect(pointer.ok && isReference(pointer.value)).toBe(true);
        expect(curly.ok && isReference(curly.value) && curly.value.syntax).toBe("curly-brace");
        expect(pointer.ok && isReference(pointer.value) && pointer.value.syntax).toBe(
            "json-pointer",
        );
    });

    it("recognises a pointer in place of part of a value", () => {
        const dimension = parseValue(
            "dimension",
            { value: { $ref: "#/size/base/$value/value" }, unit: "rem" },
            [],
        );
        if (!dimension.ok || isReference(dimension.value)) {
            expect.unreachable("a dimension with a pointer for its value");
        }
        expect(isReference(dimension.value.value)).toBe(true);
    });

    it.for([
        1.5,
        "{ratio.golden}",
        { $ref: "#/x" },
        { syntax: "curly-brace", path: 1 },
        { syntax: "json-pointer", path: "x" },
        { path: "x" },
        null,
    ])("does not take %j, as written in a file or malformed, for a read reference", (value) => {
        expect(isReference(value)).toBe(false);
    });
});

describe("parseReference", () => {
    it("reads a reference as written in a file", () => {
        expect(parseReference("{color.brand}")).toStrictEqual({
            syntax: "curly-brace",
            path: "color.brand",
        });
        expect(parseReference({ $ref: "#/color/brand" })).toStrictEqual({
            syntax: "json-pointer",
            pointer: "#/color/brand",
        });
    });

    it.for([16, "color.brand", "{}", { $ref: 1 }, { $ref: "#/a", other: 1 }, null])(
        "reads %j as no reference",
        (raw) => {
            expect(parseReference(raw)).toBeUndefined();
        },
    );
});

describe("toJsonPointer", () => {
    it.for([
        { written: "{color.ink}", pointer: "#/color/ink/$value" },
        { written: "{a~b.c/d}", pointer: "#/a~0b/c~1d/$value" },
        { written: "{color.accent.$root}", pointer: "#/color/accent/$root/$value" },
        {
            written: { $ref: "#/color/ink/$value/components/0" },
            pointer: "#/color/ink/$value/components/0",
        },
        { written: { $ref: "#/base" }, pointer: "#/base" },
    ])("writes $written as $pointer", ({ written, pointer }) => {
        const reference = parseReference(written);
        if (!reference) expect.unreachable("a reference");
        expect(toJsonPointer(reference)).toStrictEqual({ $ref: pointer });
    });
});

describe("referenceText", () => {
    it.for([
        { written: "{color.ink}", text: "color.ink" },
        {
            written: { $ref: "#/color/ink/$value/components/0" },
            text: "#/color/ink/$value/components/0",
        },
    ])("gives $text", ({ written, text }) => {
        const reference = parseReference(written);
        if (!reference) expect.unreachable("a reference");
        expect(referenceText(reference)).toBe(text);
    });
});

describe("the /values entry", () => {
    it("leaves isReference to the root entry, where Token is", async () => {
        const values = await import("../../src/values.js");
        expect("isReference" in values).toBe(false);
    });
});
