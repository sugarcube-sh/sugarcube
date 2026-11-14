import type { JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { hasParts } from "../../src/controllers/parts";
import {
    isChanged,
    toDraft,
    parseField,
    parseDraft,
    formatValue,
    hasField,
    isSameValue,
    withPoint,
    toJsonValue,
} from "../../src/controllers/value-field";

describe("parseField", () => {
    it("shows a dimension as its number and unit", () => {
        expect(parseField("dimension", { value: 2, unit: "rem" })).toEqual({
            kind: "dimension",
            value: 2,
            unit: "rem",
        });
    });

    it("shows a duration as its number and unit", () => {
        expect(parseField("duration", { value: 150, unit: "ms" })).toEqual({
            kind: "duration",
            value: 150,
            unit: "ms",
        });
    });

    it("shows a number", () => {
        expect(parseField("number", 1.5)).toEqual({ kind: "number", value: 1.5 });
    });

    it("shows a font weight as the keyword or the number the file wrote", () => {
        expect(parseField("fontWeight", "semi-bold")).toEqual({
            kind: "fontWeight",
            value: "semi-bold",
        });
        expect(parseField("fontWeight", 650)).toEqual({ kind: "fontWeight", value: 650 });
    });

    it("shows a font family as its list of fonts, remembering a single name written alone", () => {
        expect(parseField("fontFamily", "system-ui")).toEqual({
            kind: "fontFamily",
            fonts: ["system-ui"],
            single: true,
        });
        expect(parseField("fontFamily", ["Inter", "sans-serif"])).toEqual({
            kind: "fontFamily",
            fonts: ["Inter", "sans-serif"],
            single: false,
        });
    });

    it("shows a cubic Bézier as its four numbers", () => {
        expect(parseField("cubicBezier", [0.4, 0, 0.2, 1])).toEqual({
            kind: "cubicBezier",
            points: [0.4, 0, 0.2, 1],
        });
    });

    it("shows a stroke style keyword", () => {
        expect(parseField("strokeStyle", "dashed")).toEqual({
            kind: "strokeStyle",
            keyword: "dashed",
        });
    });

    it("shows a reference to a whole token as the token's path, for every type", () => {
        expect(parseField("dimension", "{size.step.0}")).toEqual({
            kind: "reference",
            path: "size.step.0",
        });
        expect(parseField("shadow", "{shadow.sm}")).toEqual({
            kind: "reference",
            path: "shadow.sm",
        });
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
            expect(parseField(type, written)).toEqual({ kind: "json", value: written });
        }
    });

    it("falls back to JSON for a token with no type", () => {
        expect(parseField(undefined, 4)).toEqual({ kind: "json", value: 4 });
    });
});

describe("toJsonValue", () => {
    it("writes what the file would hold for each field", () => {
        expect(toJsonValue({ kind: "dimension", value: 1.5, unit: "rem" })).toEqual({
            value: 1.5,
            unit: "rem",
        });
        expect(toJsonValue({ kind: "duration", value: 0.2, unit: "s" })).toEqual({
            value: 0.2,
            unit: "s",
        });
        expect(toJsonValue({ kind: "number", value: 3 })).toBe(3);
        expect(toJsonValue({ kind: "fontWeight", value: "bold" })).toBe("bold");
        expect(toJsonValue({ kind: "cubicBezier", points: [0, 0, 1, 1] })).toEqual([0, 0, 1, 1]);
        expect(toJsonValue({ kind: "strokeStyle", keyword: "solid" })).toBe("solid");
        expect(toJsonValue({ kind: "reference", path: "color.neutral.900" })).toBe(
            "{color.neutral.900}",
        );
    });

    it("writes a single font alone only where the file wrote it alone", () => {
        expect(toJsonValue({ kind: "fontFamily", fonts: ["Inter"], single: true })).toBe("Inter");
        expect(toJsonValue({ kind: "fontFamily", fonts: ["Inter"], single: false })).toEqual([
            "Inter",
        ]);
        expect(
            toJsonValue({ kind: "fontFamily", fonts: ["Inter", "sans-serif"], single: true }),
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
            expect(toJsonValue(parseField(type, value))).toEqual(value);
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

describe("toDraft", () => {
    it("starts a field's draft from the value shown", () => {
        expect(toDraft("dimension", { kind: "dimension", value: 2, unit: "rem" })).toEqual({
            kind: "dimension",
            amount: "2",
            unit: "rem",
        });
        expect(toDraft("cubicBezier", { kind: "cubicBezier", points: [0.4, 0, 0.2, 1] })).toEqual({
            kind: "cubicBezier",
            points: ["0.4", "0", "0.2", "1"],
        });
        expect(
            toDraft("fontFamily", { kind: "fontFamily", fonts: ["Inter"], single: true }),
        ).toEqual({ kind: "fontFamily", fonts: ["Inter"], single: true });
    });

    it("starts blank where nothing is written", () => {
        expect(toDraft("duration", undefined)).toEqual({ kind: "duration", amount: "", unit: "" });
        expect(toDraft("strokeStyle", undefined)).toEqual({ kind: "strokeStyle", keyword: "" });
        expect(toDraft("fontWeight", undefined)).toEqual({
            kind: "fontWeight",
            choice: "",
            amount: "",
        });
    });

    it("gives a keyword weight its number, ready for switching to Number", () => {
        expect(toDraft("fontWeight", { kind: "fontWeight", value: "bold" })).toEqual({
            kind: "fontWeight",
            choice: "bold",
            amount: "700",
        });
        expect(toDraft("fontWeight", { kind: "fontWeight", value: 650 })).toEqual({
            kind: "fontWeight",
            choice: "number",
            amount: "650",
        });
    });
});

describe("parseDraft", () => {
    it("makes a field once the draft holds a whole value", () => {
        expect(parseDraft({ kind: "dimension", amount: "1.5", unit: "rem" })).toEqual({
            kind: "dimension",
            value: 1.5,
            unit: "rem",
        });
        expect(parseDraft({ kind: "number", amount: "1e2" })).toEqual({
            kind: "number",
            value: 100,
        });
        expect(parseDraft({ kind: "fontWeight", choice: "number", amount: "700" })).toEqual({
            kind: "fontWeight",
            value: 700,
        });
        expect(parseDraft({ kind: "fontWeight", choice: "bold", amount: "700" })).toEqual({
            kind: "fontWeight",
            value: "bold",
        });
        expect(parseDraft({ kind: "cubicBezier", points: ["0", "0", "1", "1"] })).toEqual({
            kind: "cubicBezier",
            points: [0, 0, 1, 1],
        });
        expect(
            parseDraft({ kind: "fontFamily", fonts: ["Inter", "sans-serif"], single: false }),
        ).toEqual({ kind: "fontFamily", fonts: ["Inter", "sans-serif"], single: false });
        expect(parseDraft({ kind: "strokeStyle", keyword: "dotted" })).toEqual({
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
            { kind: "fontFamily", fonts: ["Inter", ""], single: false },
            { kind: "fontFamily", fonts: [], single: false },
            { kind: "strokeStyle", keyword: "" },
        ] as const;

        for (const draft of half) expect(parseDraft(draft)).toBeUndefined();
    });
});

describe("isSameValue", () => {
    it("tells whether what is typed already means the value shown", () => {
        expect(isSameValue({ kind: "number", amount: "1e2" }, { kind: "number", value: 100 })).toBe(
            true,
        );
        expect(isSameValue({ kind: "number", amount: "1.0" }, { kind: "number", value: 1 })).toBe(
            true,
        );
        expect(isSameValue({ kind: "number", amount: "2" }, { kind: "number", value: 3 })).toBe(
            false,
        );
        expect(
            isSameValue(
                { kind: "dimension", amount: "2", unit: "" },
                { kind: "dimension", value: 2, unit: "px" },
            ),
        ).toBe(false);
    });
});

describe("isChanged", () => {
    it("is false when the field writes what the file already says", () => {
        expect(
            isChanged({ kind: "dimension", value: 2, unit: "rem" }, { value: 2, unit: "rem" }),
        ).toBe(false);
        expect(isChanged({ kind: "reference", path: "a.b" }, "{a.b}")).toBe(false);
        expect(isChanged({ kind: "number", value: 2 }, 3)).toBe(true);
        expect(isChanged({ kind: "number", value: 2 }, undefined)).toBe(true);
    });

    it("is false when the file writes the same value with its keys in another order", () => {
        expect(
            isChanged({ kind: "dimension", value: 2, unit: "rem" }, { unit: "rem", value: 2 }),
        ).toBe(false);
    });
});

const px = (value: number) => ({ value, unit: "px" });
const layer = { color: "#0000001a", offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) };

describe("composite fields", () => {
    it("shows a border as its parts, in the spec's order, each with where it is", () => {
        expect(
            parseField("border", { style: "solid", color: "{color.ink}", width: px(1) }),
        ).toEqual({
            kind: "parts",
            parts: [
                { name: "color", part: ["color"], type: "color", value: "{color.ink}" },
                { name: "width", part: ["width"], type: "dimension", value: px(1) },
                { name: "style", part: ["style"], type: "strokeStyle", value: "solid" },
            ],
        });
    });

    it("shows a part the value doesn't write, empty", () => {
        const field = parseField("transition", {
            duration: { value: 200, unit: "ms" },
            delay: { value: 0, unit: "ms" },
        });

        expect(field.kind === "parts" && field.parts.at(-1)).toEqual({
            name: "timingFunction",
            part: ["timingFunction"],
            type: "cubicBezier",
            value: undefined,
        });
    });

    it("shows a single shadow as a list of one, written where the value is", () => {
        const field = parseField("shadow", layer);

        expect(field).toMatchObject({ kind: "list", type: "shadow", single: true });
        expect(
            field.kind === "list" && field.items.map(({ part: at, display }) => [at, display]),
        ).toEqual([[[], "parts"]]);
    });

    it("shows each item of a list at its index, as parts, a reference, or JSON", () => {
        const field = parseField("shadow", [layer, "{shadow.sm}", { ...layer, glow: true }]);

        expect(field).toMatchObject({ kind: "list", type: "shadow", single: false });
        expect(
            field.kind === "list" && field.items.map(({ part: at, display }) => [at, display]),
        ).toEqual([
            [[0], "parts"],
            [[1], "reference"],
            [[2], "json"],
        ]);
    });

    it("gives a list item's parts, with where each is inside the item", () => {
        const field = parseField("gradient", [{ color: "#000000", position: 0 }]);
        const [stop] = field.kind === "list" ? field.items : [];

        expect(field).toMatchObject({ kind: "list", type: "gradient" });
        expect(stop?.display === "parts" && stop.parts).toEqual([
            { name: "color", part: ["color"], type: "color", value: "#000000" },
            { name: "position", part: ["position"], type: "number", value: 0 },
        ]);
    });

    it("shows a stroke style's dashes, each at its place in the dash array", () => {
        expect(
            parseField("strokeStyle", { dashArray: [px(4), "{size.dash}"], lineCap: "round" }),
        ).toEqual({
            kind: "dashes",
            dashes: [
                { part: ["dashArray", 0], type: "dimension", value: px(4) },
                { part: ["dashArray", 1], type: "dimension", value: "{size.dash}" },
            ],
            lineCap: "round",
        });
    });

    it("tells the fields drawn part by part from the rest", () => {
        expect(hasParts(parseField("border", { color: "#000000" }))).toBe(true);
        expect(hasParts(parseField("shadow", layer))).toBe(true);
        expect(hasParts(parseField("strokeStyle", { dashArray: [px(4)], lineCap: "round" }))).toBe(
            true,
        );
        expect(hasParts(parseField("strokeStyle", "solid"))).toBe(false);
        expect(hasParts(parseField("border", "{border.thin}"))).toBe(false);
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
            expect(parseField(type, written)).toEqual({ kind: "json", value: written });
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
            expect(toJsonValue(parseField(type, written))).toEqual(written);
        }
    });
});

describe("withPoint", () => {
    it("changes one point of a cubic Bézier's draft", () => {
        const draft = toDraft("cubicBezier", { kind: "cubicBezier", points: [0.4, 0, 0.2, 1] });
        if (draft.kind !== "cubicBezier") throw new Error(draft.kind);

        expect(withPoint(draft, 2, "0.3").points).toEqual(["0.4", "0", "0.3", "1"]);
    });
});

describe("formatValue", () => {
    it("words a value the way its field shows it, for a field that can't be edited", () => {
        expect(formatValue("dimension", { value: 0.8333, unit: "rem" })).toBe("0.8333rem");
        expect(formatValue("duration", { value: 200, unit: "ms" })).toBe("200ms");
        expect(formatValue("number", 1.25)).toBe("1.25");
    });

    it("falls back to the JSON as written for a value with no field, or one a field can't show", () => {
        expect(formatValue(undefined, "adjacent")).toBe('"adjacent"');
        expect(formatValue("dimension", { value: 1, unit: "em" })).toBe('{"value":1,"unit":"em"}');
    });
});
