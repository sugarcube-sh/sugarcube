import { describe, expect, it } from "vitest";
import { compositeFields, writeCompositeField } from "../src/mvp/composite";
import { readField } from "../src/mvp/value-field";

const BORDER = {
    color: "#000000",
    width: { value: 1, unit: "px" },
    style: "solid",
};

const TYPOGRAPHY = {
    fontFamily: "Inter",
    fontSize: { value: 16, unit: "px" },
    lineHeight: 1.5,
};

const keys = (type: string, value: unknown) => compositeFields(type, value).map((f) => f.key);

describe("compositeFields", () => {
    it("names a border's three parts, with the type each one edits as", () => {
        expect(compositeFields("border", BORDER)).toEqual([
            { key: "color", label: "Colour", type: "color" },
            { key: "width", label: "Width", type: "dimension" },
            { key: "style", label: "Style", type: "strokeStyle" },
        ]);
    });

    it("names a transition's three parts", () => {
        expect(
            keys("transition", {
                duration: { value: 200, unit: "ms" },
                delay: { value: 0, unit: "ms" },
                timingFunction: [0.4, 0, 0.2, 1],
            }),
        ).toEqual(["duration", "delay", "timingFunction"]);
    });

    it("leaves out the optional parts of a typography a token does not carry", () => {
        expect(keys("typography", TYPOGRAPHY)).toEqual(["fontFamily", "fontSize", "lineHeight"]);
    });

    it("gives a composite that is a reference no parts, so it stays one text box", () => {
        expect(keys("border", "{border.default}")).toEqual([]);
    });

    it("gives a non-composite type no parts", () => {
        expect(keys("color", "#fff")).toEqual([]);
        expect(keys("shadow", [{ color: "#000" }])).toEqual([]);
    });
});

describe("writeCompositeField", () => {
    it("replaces one part and leaves the others alone", () => {
        expect(writeCompositeField(BORDER, "width", { value: 2, unit: "px" })).toEqual({
            color: "#000000",
            width: { value: 2, unit: "px" },
            style: "solid",
        });
    });
});

describe("readField, on a composite", () => {
    it("summarises a border rather than printing its JSON", () => {
        expect(readField("border", BORDER)).toEqual({
            text: "#000000 1px solid",
            editable: false,
        });
    });

    it("summarises a typography from the parts it has", () => {
        expect(readField("typography", TYPOGRAPHY).text).toBe("Inter 16px 1.5");
    });

    it("still prints JSON for an object shape it has no parts for", () => {
        expect(readField("strokeStyle", { dashArray: ["2px"], lineCap: "round" })).toEqual({
            text: '{"dashArray":["2px"],"lineCap":"round"}',
            editable: false,
        });
    });
});
