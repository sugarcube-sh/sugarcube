import { describe, expect, it } from "vitest";
import {
    isAlias,
    isPointer,
    parseDimension,
    parseNumber,
    readReference,
} from "../../src/values.js";

describe("isAlias and isPointer", () => {
    it("recognise the references a parser reads", () => {
        const alias = parseNumber("{ratio.golden}", []);
        const pointer = parseNumber({ $ref: "#/ratio/golden/$value" }, []);
        expect(alias.ok && isAlias(alias.value)).toBe(true);
        expect(pointer.ok && isPointer(pointer.value)).toBe(true);
        expect(alias.ok && isPointer(alias.value)).toBe(false);
        expect(pointer.ok && isAlias(pointer.value)).toBe(false);
    });

    it("recognise a pointer in place of part of a value", () => {
        const dimension = parseDimension(
            { value: { $ref: "#/size/base/$value/value" }, unit: "rem" },
            [],
        );
        if (!dimension.ok || isAlias(dimension.value) || isPointer(dimension.value)) {
            expect.unreachable("a dimension with a pointer for its value");
        }
        expect(isPointer(dimension.value.value)).toBe(true);
    });

    it.for([1.5, "{ratio.golden}", { $ref: "#/x" }, { alias: 1 }, { alias: "a", extra: 1 }, null])(
        "do not take %j, as written in a file or malformed, for a read reference",
        (value) => {
            expect(isAlias(value)).toBe(false);
            expect(isPointer(value)).toBe(false);
        },
    );
});

describe("readReference", () => {
    it("reads a reference as written in a file", () => {
        expect(readReference("{color.brand}")).toStrictEqual({ alias: "color.brand" });
        expect(readReference({ $ref: "#/color/brand" })).toStrictEqual({
            pointer: "#/color/brand",
        });
    });

    it.for([16, "color.brand", "{}", { $ref: 1 }, { $ref: "#/a", other: 1 }, null])(
        "reads %j as no reference",
        (raw) => {
            expect(readReference(raw)).toBeUndefined();
        },
    );
});
