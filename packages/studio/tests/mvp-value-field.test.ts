import { describe, expect, it } from "vitest";
import { readField, writeField } from "../src/mvp/value-field";
import { compositeFields, readLayers } from "../src/mvp/composite";
import { DTCG_TYPES, emptyValueFor } from "../src/mvp/value-field";

const OKLCH = {
    colorSpace: "oklch" as const,
    components: [0.624, 0.181, 258] as [number, number, number],
    hex: "#4d7bd9",
};

describe("readField", () => {
    it("shows a reference as the text it was authored as", () => {
        expect(readField("color", "{color.neutral.900}")).toEqual({
            text: "{color.neutral.900}",
            editable: true,
        });
    });

    it("shows a number and a dimension as editable text", () => {
        expect(readField("number", 1.5)).toEqual({ text: "1.5", editable: true });
        expect(readField("dimension", { value: 16, unit: "px" })).toEqual({
            text: "16px",
            editable: true,
        });
    });

    it("shows a literal colour as an editable colour string", () => {
        const field = readField("color", OKLCH);

        expect(field.editable).toBe(true);
        expect(field.text).toContain("oklch");
    });

    it("shows a font stack as one editable line", () => {
        expect(readField("fontFamily", ["Inter", "system-ui", "sans-serif"])).toEqual({
            text: "Inter, system-ui, sans-serif",
            editable: true,
        });
        expect(readField("fontFamily", "system-ui, sans-serif")).toEqual({
            text: "system-ui, sans-serif",
            editable: true,
        });
    });

    it("shows a bezier as its four numbers", () => {
        expect(readField("cubicBezier", [0.16, 1, 0.3, 1])).toEqual({
            text: "0.16, 1, 0.3, 1",
            editable: true,
        });
    });

    it("shows a composite read only, summarised from the parts it carries", () => {
        expect(readField("shadow", { color: "#000", offsetX: "0px" })).toEqual({
            text: "#000 0px",
            editable: false,
        });
    });

    it("falls back to JSON for an object shape it has no parts for", () => {
        expect(readField("strokeStyle", { dashArray: ["2px"], lineCap: "round" })).toEqual({
            text: '{"dashArray":["2px"],"lineCap":"round"}',
            editable: false,
        });
    });

    it("has empty text for a token with no value in this context", () => {
        expect(readField("color", undefined)).toEqual({ text: "", editable: false });
    });

    it("offers a font weight as a choice, whichever shape it was authored in", () => {
        const numeric = readField("fontWeight", 700);
        expect(numeric.text).toBe("700");
        expect(numeric.editable).toBe(true);
        expect(numeric.choices?.find((c) => c.value === "700")?.label).toBe("Bold");

        expect(readField("fontWeight", "bold").text).toBe("700");
    });

    it("keeps a weight the spec does not name among the choices", () => {
        expect(readField("fontWeight", 350).choices?.map((c) => c.value)).toContain("350");
    });

    it("offers a stroke style keyword as a choice", () => {
        const field = readField("strokeStyle", "dashed");

        expect(field).toMatchObject({ text: "dashed", editable: true });
        expect(field.choices?.map((c) => c.value)).toContain("solid");
    });

    it("leaves the object form of a stroke style read only", () => {
        const field = readField("strokeStyle", { dashArray: ["2px"], lineCap: "round" });

        expect(field.editable).toBe(false);
        expect(field.choices).toBeUndefined();
    });
});

describe("writeField", () => {
    it("writes a string straight through", () => {
        expect(writeField("color", "{color.brand.500}", "{color.brand.700}")).toBe(
            "{color.brand.700}",
        );
    });

    it("keeps the number and dimension shapes it was given", () => {
        expect(writeField("number", 1.5, "2")).toBe(2);
        expect(writeField("dimension", { value: 16, unit: "px" }, "1.5rem")).toEqual({
            value: 1.5,
            unit: "rem",
        });
    });

    it("keeps a colour in the shape it was authored in", () => {
        const next = writeField("color", OKLCH, "oklch(0.5 0.1 258)");

        expect(next).toMatchObject({ colorSpace: "oklch" });
        expect(next).toHaveProperty("hex");
    });

    it("keeps a hex colour as hex", () => {
        expect(writeField("color", "#4d7bd9", "#ffffff")).toBe("#ffffff");
    });

    it("keeps a font stack as an array or a string, whichever it was", () => {
        expect(writeField("fontFamily", ["Inter", "sans-serif"], "Inter, system-ui")).toEqual([
            "Inter",
            "system-ui",
        ]);
        expect(writeField("fontFamily", "system-ui", "Helvetica")).toBe("Helvetica");
    });

    // DTCG 2025.10 8.3: the string form holds a single font name, so a stack
    // typed into a single-name field becomes an array rather than a string.
    it("promotes a single name to an array once a second name is typed in", () => {
        expect(writeField("fontFamily", "system-ui", "Helvetica, sans-serif")).toEqual([
            "Helvetica",
            "sans-serif",
        ]);
    });

    it("writes a bezier back as four numbers", () => {
        expect(writeField("cubicBezier", [0.16, 1, 0.3, 1], "0.42, 0, 0.58, 1")).toEqual([
            0.42, 0, 0.58, 1,
        ]);
    });

    it("rejects text that does not fit the shape", () => {
        expect(writeField("number", 1.5, "wide")).toBeUndefined();
        expect(writeField("number", 1.5, "")).toBeUndefined();
        expect(writeField("dimension", { value: 16, unit: "px" }, "16")).toBeUndefined();
        expect(writeField("color", OKLCH, "not a colour")).toBeUndefined();
        expect(writeField("fontFamily", ["Inter"], "")).toBeUndefined();
        expect(writeField("cubicBezier", [0.16, 1, 0.3, 1], "0.42, 0, 0.58")).toBeUndefined();
    });

    // D-041: the field parses; whether the curve is legal is core's call.
    it("accepts any four numbers for a bezier, legal curve or not", () => {
        expect(writeField("cubicBezier", [0.16, 1, 0.3, 1], "1.4, 0, 0.58, 1")).toEqual([
            1.4, 0, 0.58, 1,
        ]);
        expect(writeField("cubicBezier", [0.16, 1, 0.3, 1], "0.4, 9, 0.58, -9")).toEqual([
            0.4, 9, 0.58, -9,
        ]);
    });

    it("rejects every edit to a shape a text box cannot express", () => {
        expect(writeField("shadow", { color: "#000" }, "anything")).toBeUndefined();
    });

    it("keeps a font weight numeric or keyword, whichever it was", () => {
        expect(writeField("fontWeight", 400, "700")).toBe(700);
        expect(writeField("fontWeight", "normal", "700")).toBe("bold");
    });

    // A weight with no keyword has to stay a number even in a keyword token,
    // because there is nothing else to write.
    it("falls back to the number when no keyword names the weight", () => {
        expect(writeField("fontWeight", "normal", "350")).toBe(350);
    });

    it("writes a stroke style keyword straight through", () => {
        expect(writeField("strokeStyle", "solid", "dashed")).toBe("dashed");
    });

    it("round-trips what readField showed", () => {
        const cases: Array<[string, unknown]> = [
            ["dimension", { value: 16, unit: "px" }],
            ["fontFamily", ["Inter", "system-ui", "sans-serif"]],
            ["fontFamily", "system-ui"],
            ["cubicBezier", [0.16, 1, 0.3, 1]],
            ["color", "#4d7bd9"],
            ["fontWeight", 700],
            ["fontWeight", "bold"],
            ["strokeStyle", "dashed"],
        ];

        for (const [type, value] of cases) {
            const { text } = readField(type, value);
            expect(writeField(type, value, text)).toEqual(value);
        }
    });
});

describe("a new token of every type the select offers", () => {
    it.each(DTCG_TYPES)("%s starts with a value the page can show and grow", (type) => {
        const value = emptyValueFor(type);
        const field = readField(type, value);

        if (["shadow", "gradient"].includes(type)) {
            expect(readLayers(type, value)).toBeDefined();
        } else if (["typography", "border", "transition"].includes(type)) {
            expect(compositeFields(type, value).length).toBeGreaterThan(0);
        } else if (type !== "fluidDimension") {
            expect(field.editable).toBe(true);
        }
    });

    it("has no editor for a fluid dimension yet, so it shows as text", () => {
        expect(readField("fluidDimension", emptyValueFor("fluidDimension")).editable).toBe(false);
    });
});
