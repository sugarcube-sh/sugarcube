import type { JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { hasParts } from "../../src/controllers/parts";
import {
    changes,
    draftFor,
    fieldFor,
    fieldFrom,
    fieldText,
    hasField,
    says,
    withPoint,
    writtenFor,
} from "../../src/controllers/value-field";

describe("fieldFor", () => {
    it("shows a dimension as its number and unit", () => {
        expect(fieldFor("dimension", { value: 2, unit: "rem" })).toEqual({
            kind: "dimension",
            value: 2,
            unit: "rem",
        });
    });

    it("shows a duration as its number and unit", () => {
        expect(fieldFor("duration", { value: 150, unit: "ms" })).toEqual({
            kind: "duration",
            value: 150,
            unit: "ms",
        });
    });

    it("shows a number", () => {
        expect(fieldFor("number", 1.5)).toEqual({ kind: "number", value: 1.5 });
    });

    it("shows a font weight as the keyword or the number the file wrote", () => {
        expect(fieldFor("fontWeight", "semi-bold")).toEqual({
            kind: "fontWeight",
            value: "semi-bold",
        });
        expect(fieldFor("fontWeight", 650)).toEqual({ kind: "fontWeight", value: 650 });
    });

    it("shows a font family as its list of fonts, remembering a single name written alone", () => {
        expect(fieldFor("fontFamily", "system-ui")).toEqual({
            kind: "fontFamily",
            fonts: ["system-ui"],
            alone: true,
        });
        expect(fieldFor("fontFamily", ["Inter", "sans-serif"])).toEqual({
            kind: "fontFamily",
            fonts: ["Inter", "sans-serif"],
            alone: false,
        });
    });

    it("shows a cubic Bézier as its four numbers", () => {
        expect(fieldFor("cubicBezier", [0.4, 0, 0.2, 1])).toEqual({
            kind: "cubicBezier",
            points: [0.4, 0, 0.2, 1],
        });
    });

    it("shows a stroke style keyword", () => {
        expect(fieldFor("strokeStyle", "dashed")).toEqual({
            kind: "strokeStyle",
            keyword: "dashed",
        });
    });

    it("shows a reference to a whole token as the token's path, for every type", () => {
        expect(fieldFor("dimension", "{size.step.0}")).toEqual({
            kind: "reference",
            path: "size.step.0",
        });
        expect(fieldFor("shadow", "{shadow.sm}")).toEqual({ kind: "reference", path: "shadow.sm" });
    });

    it("falls back to JSON for what no field can show exactly", () => {
        const fallbacks: [TokenType, JsonValue][] = [
            ["dimension", { value: 2, unit: "em" }],
            ["dimension", { value: 2, unit: "rem", note: "fluid" }],
            ["dimension", "2rem"],
            ["dimension", { $ref: "#/size/step/0/$value" }],
            ["fontWeight", "Bold"],
            ["cubicBezier", [0.4, 0, 0.2]],
        ];

        for (const [type, written] of fallbacks) {
            expect(fieldFor(type, written)).toEqual({ kind: "json", value: written });
        }
    });

    it("falls back to JSON for a token with no type", () => {
        expect(fieldFor(undefined, 4)).toEqual({ kind: "json", value: 4 });
    });
});

describe("writtenFor", () => {
    it("writes what the file would hold for each field", () => {
        expect(writtenFor({ kind: "dimension", value: 1.5, unit: "rem" })).toEqual({
            value: 1.5,
            unit: "rem",
        });
        expect(writtenFor({ kind: "duration", value: 0.2, unit: "s" })).toEqual({
            value: 0.2,
            unit: "s",
        });
        expect(writtenFor({ kind: "number", value: 3 })).toBe(3);
        expect(writtenFor({ kind: "fontWeight", value: "bold" })).toBe("bold");
        expect(writtenFor({ kind: "cubicBezier", points: [0, 0, 1, 1] })).toEqual([0, 0, 1, 1]);
        expect(writtenFor({ kind: "strokeStyle", keyword: "solid" })).toBe("solid");
        expect(writtenFor({ kind: "reference", path: "color.neutral.900" })).toBe(
            "{color.neutral.900}",
        );
    });

    it("writes a single font alone only where the file wrote it alone", () => {
        expect(writtenFor({ kind: "fontFamily", fonts: ["Inter"], alone: true })).toBe("Inter");
        expect(writtenFor({ kind: "fontFamily", fonts: ["Inter"], alone: false })).toEqual([
            "Inter",
        ]);
        expect(
            writtenFor({ kind: "fontFamily", fonts: ["Inter", "sans-serif"], alone: true }),
        ).toEqual(["Inter", "sans-serif"]);
    });

    it("writes back exactly what it was shown", () => {
        const written: [TokenType, JsonValue][] = [
            ["dimension", { value: 2, unit: "rem" }],
            ["fontWeight", 650],
            ["fontWeight", "semi-bold"],
            ["fontFamily", "system-ui"],
            ["fontFamily", ["Inter", "sans-serif"]],
            ["cubicBezier", [0.4, 0, 0.2, 1]],
            ["dimension", "{size.step.0}"],
            ["color", { colorSpace: "srgb", components: [1, 0, 0] }],
        ];

        for (const [type, value] of written) {
            expect(writtenFor(fieldFor(type, value))).toEqual(value);
        }
    });
});

describe("hasField", () => {
    it("names the types with a field of their own", () => {
        expect(
            [
                "dimension",
                "duration",
                "number",
                "fontWeight",
                "fontFamily",
                "cubicBezier",
                "strokeStyle",
                "color",
            ].every((type) => hasField(type as TokenType)),
        ).toBe(true);
        expect(
            ["border", "transition", "shadow", "gradient", "typography"].some((type) =>
                hasField(type as TokenType),
            ),
        ).toBe(false);
    });
});

describe("draftFor", () => {
    it("starts a field's draft from the value shown", () => {
        expect(draftFor("dimension", { kind: "dimension", value: 2, unit: "rem" })).toEqual({
            kind: "dimension",
            amount: "2",
            unit: "rem",
        });
        expect(draftFor("cubicBezier", { kind: "cubicBezier", points: [0.4, 0, 0.2, 1] })).toEqual({
            kind: "cubicBezier",
            points: ["0.4", "0", "0.2", "1"],
        });
        expect(
            draftFor("fontFamily", { kind: "fontFamily", fonts: ["Inter"], alone: true }),
        ).toEqual({ kind: "fontFamily", fonts: ["Inter"], alone: true });
    });

    it("starts blank where nothing is written", () => {
        expect(draftFor("duration", undefined)).toEqual({ kind: "duration", amount: "", unit: "" });
        expect(draftFor("strokeStyle", undefined)).toEqual({ kind: "strokeStyle", keyword: "" });
        expect(draftFor("fontWeight", undefined)).toEqual({
            kind: "fontWeight",
            choice: "",
            amount: "",
        });
    });

    it("gives a keyword weight its number, ready for switching to Number", () => {
        expect(draftFor("fontWeight", { kind: "fontWeight", value: "bold" })).toEqual({
            kind: "fontWeight",
            choice: "bold",
            amount: "700",
        });
        expect(draftFor("fontWeight", { kind: "fontWeight", value: 650 })).toEqual({
            kind: "fontWeight",
            choice: "number",
            amount: "650",
        });
    });
});

describe("fieldFrom", () => {
    it("makes a field once the draft holds a whole value", () => {
        expect(fieldFrom({ kind: "dimension", amount: "1.5", unit: "rem" })).toEqual({
            kind: "dimension",
            value: 1.5,
            unit: "rem",
        });
        expect(fieldFrom({ kind: "number", amount: "1e2" })).toEqual({
            kind: "number",
            value: 100,
        });
        expect(fieldFrom({ kind: "fontWeight", choice: "number", amount: "700" })).toEqual({
            kind: "fontWeight",
            value: 700,
        });
        expect(fieldFrom({ kind: "fontWeight", choice: "bold", amount: "700" })).toEqual({
            kind: "fontWeight",
            value: "bold",
        });
        expect(fieldFrom({ kind: "cubicBezier", points: ["0", "0", "1", "1"] })).toEqual({
            kind: "cubicBezier",
            points: [0, 0, 1, 1],
        });
        expect(
            fieldFrom({ kind: "fontFamily", fonts: ["Inter", "sans-serif"], alone: false }),
        ).toEqual({ kind: "fontFamily", fonts: ["Inter", "sans-serif"], alone: false });
        expect(fieldFrom({ kind: "strokeStyle", keyword: "dotted" })).toEqual({
            kind: "strokeStyle",
            keyword: "dotted",
        });
    });

    it("makes nothing while the draft is half done", () => {
        const half = [
            { kind: "dimension", amount: "1.5", unit: "" },
            { kind: "dimension", amount: "", unit: "rem" },
            { kind: "dimension", amount: "1e", unit: "px" },
            { kind: "duration", amount: "fast", unit: "ms" },
            { kind: "number", amount: "-" },
            { kind: "fontWeight", choice: "", amount: "" },
            { kind: "fontWeight", choice: "number", amount: "" },
            { kind: "cubicBezier", points: ["0", "0", "1", ""] },
            { kind: "fontFamily", fonts: ["Inter", ""], alone: false },
            { kind: "fontFamily", fonts: [], alone: false },
            { kind: "strokeStyle", keyword: "" },
        ] as const;

        for (const draft of half) expect(fieldFrom(draft)).toBeUndefined();
    });
});

describe("says", () => {
    it("tells whether what is typed already means the value shown", () => {
        expect(says({ kind: "number", amount: "1e2" }, { kind: "number", value: 100 })).toBe(true);
        expect(says({ kind: "number", amount: "1.0" }, { kind: "number", value: 1 })).toBe(true);
        expect(says({ kind: "number", amount: "2" }, { kind: "number", value: 3 })).toBe(false);
        expect(
            says(
                { kind: "dimension", amount: "2", unit: "" },
                { kind: "dimension", value: 2, unit: "px" },
            ),
        ).toBe(false);
    });
});

describe("changes", () => {
    it("is false when the field writes what the file already says", () => {
        expect(
            changes({ kind: "dimension", value: 2, unit: "rem" }, { value: 2, unit: "rem" }),
        ).toBe(false);
        expect(changes({ kind: "reference", path: "a.b" }, "{a.b}")).toBe(false);
        expect(changes({ kind: "number", value: 2 }, 3)).toBe(true);
        expect(changes({ kind: "number", value: 2 }, undefined)).toBe(true);
    });
});

const px = (value: number) => ({ value, unit: "px" });
const layer = { color: "#0000001a", offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) };

describe("composite fields", () => {
    it("shows a border as its parts, in the spec's order, each with where it is", () => {
        expect(fieldFor("border", { style: "solid", color: "{color.ink}", width: px(1) })).toEqual({
            kind: "parts",
            parts: [
                { name: "color", at: ["color"], type: "color", written: "{color.ink}" },
                { name: "width", at: ["width"], type: "dimension", written: px(1) },
                { name: "style", at: ["style"], type: "strokeStyle", written: "solid" },
            ],
        });
    });

    it("shows a part the value doesn't write, empty", () => {
        const field = fieldFor("transition", {
            duration: { value: 200, unit: "ms" },
            delay: { value: 0, unit: "ms" },
        });

        expect(field.kind === "parts" && field.parts.at(-1)).toEqual({
            name: "timingFunction",
            at: ["timingFunction"],
            type: "cubicBezier",
            written: undefined,
        });
    });

    it("shows a single shadow as a list of one, written where the value is", () => {
        const field = fieldFor("shadow", layer);

        expect(field).toMatchObject({ kind: "list", type: "shadow", single: true });
        expect(field.kind === "list" && field.items.map(({ at, shown }) => [at, shown])).toEqual([
            [[], "parts"],
        ]);
    });

    it("shows each item of a list at its index, as parts, a reference, or JSON", () => {
        const field = fieldFor("shadow", [layer, "{shadow.sm}", { ...layer, glow: true }]);

        expect(field).toMatchObject({ kind: "list", type: "shadow", single: false });
        expect(field.kind === "list" && field.items.map(({ at, shown }) => [at, shown])).toEqual([
            [[0], "parts"],
            [[1], "reference"],
            [[2], "json"],
        ]);
    });

    it("gives a list item's parts, with where each is inside the item", () => {
        const field = fieldFor("gradient", [{ color: "#000000", position: 0 }]);
        const [stop] = field.kind === "list" ? field.items : [];

        expect(field).toMatchObject({ kind: "list", type: "gradient" });
        expect(stop?.shown === "parts" && stop.parts).toEqual([
            { name: "color", at: ["color"], type: "color", written: "#000000" },
            { name: "position", at: ["position"], type: "number", written: 0 },
        ]);
    });

    it("shows a stroke style's dashes, each at its place in the dash array", () => {
        expect(
            fieldFor("strokeStyle", { dashArray: [px(4), "{size.dash}"], lineCap: "round" }),
        ).toEqual({
            kind: "dashes",
            dashes: [
                { at: ["dashArray", 0], type: "dimension", written: px(4) },
                { at: ["dashArray", 1], type: "dimension", written: "{size.dash}" },
            ],
            lineCap: "round",
        });
    });

    it("tells the fields drawn part by part from the rest", () => {
        expect(hasParts(fieldFor("border", { color: "#000000" }))).toBe(true);
        expect(hasParts(fieldFor("shadow", layer))).toBe(true);
        expect(hasParts(fieldFor("strokeStyle", { dashArray: [px(4)], lineCap: "round" }))).toBe(
            true,
        );
        expect(hasParts(fieldFor("strokeStyle", "solid"))).toBe(false);
        expect(hasParts(fieldFor("border", "{border.thin}"))).toBe(false);
    });

    it("falls back to JSON for a composite it can't show exactly", () => {
        const odd: [TokenType, JsonValue][] = [
            ["border", { color: "#000000", width: px(1), style: "solid", radius: px(4) }],
            ["border", "solid"],
            ["shadow", []],
            ["shadow", 4],
            ["gradient", { color: "#000000", position: 0 }],
            ["typography", [1, 2]],
            ["strokeStyle", { dashArray: [px(4)], lineCap: "round", gap: px(2) }],
            ["strokeStyle", { dashArray: px(4), lineCap: "round" }],
        ];

        for (const [type, written] of odd) {
            expect(fieldFor(type, written)).toEqual({ kind: "json", value: written });
        }
    });

    it("writes back exactly what it was shown", () => {
        const shown: [TokenType, JsonValue][] = [
            ["border", { color: "{color.ink}", width: px(1), style: "solid" }],
            ["shadow", layer],
            ["shadow", [layer, "{shadow.sm}"]],
            ["strokeStyle", { dashArray: [px(4)], lineCap: "butt" }],
        ];

        for (const [type, written] of shown) {
            expect(writtenFor(fieldFor(type, written))).toEqual(written);
        }
    });
});

describe("withPoint", () => {
    it("changes one point of a cubic Bézier's draft", () => {
        const draft = draftFor("cubicBezier", { kind: "cubicBezier", points: [0.4, 0, 0.2, 1] });
        if (draft.kind !== "cubicBezier") throw new Error(draft.kind);

        expect(withPoint(draft, 2, "0.3").points).toEqual(["0.4", "0", "0.3", "1"]);
    });
});

describe("fieldText", () => {
    it("words a value the way its field shows it, for a field that can't be edited", () => {
        expect(fieldText("dimension", { value: 0.8333, unit: "rem" })).toBe("0.8333rem");
        expect(fieldText("duration", { value: 200, unit: "ms" })).toBe("200ms");
        expect(fieldText("number", 1.25)).toBe("1.25");
    });

    it("falls back to the JSON as written for a value with no field, or one a field can't show", () => {
        expect(fieldText(undefined, "adjacent")).toBe('"adjacent"');
        expect(fieldText("dimension", { value: 1, unit: "em" })).toBe('{"value":1,"unit":"em"}');
    });
});
