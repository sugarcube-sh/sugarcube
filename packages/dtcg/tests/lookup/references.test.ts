import { describe, expect, it } from "vitest";
import { readFromMemory, references, token } from "../../src/index.js";

const color = { colorSpace: "srgb", components: [1, 0, 0] };
const px = (value: number) => ({ value, unit: "px" });

const tokens = {
    red: { $type: "color", $value: color },
    blue: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 1] } },
    thin: { $type: "dimension", $value: px(1) },
    half: { $type: "number", $value: 0.5 },
    family: { $type: "fontFamily", $value: "Inter" },
    plain: { $type: "dimension", $value: px(4) },
    accent: { $type: "color", $value: "{red}" },
    border: {
        $type: "border",
        $value: { color: "{red}", width: "{thin}", style: "solid" },
    },
    lone: {
        $type: "shadow",
        $value: { color: "{red}", offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) },
    },
    layered: {
        $type: "shadow",
        $value: [
            "{lone}",
            { color: color, offsetX: "{thin}", offsetY: px(1), blur: px(2), spread: px(0) },
        ],
    },
    fade: {
        $type: "gradient",
        $value: [
            { color: "{red}", position: 0 },
            { color: "{blue}", position: "{half}" },
        ],
    },
    dash: {
        $type: "strokeStyle",
        $value: { dashArray: ["{thin}", px(2)], lineCap: "round" },
    },
    body: {
        $type: "typography",
        $value: {
            fontFamily: "{family}",
            fontSize: px(16),
            fontWeight: 400,
            letterSpacing: px(0),
            lineHeight: "{half}",
        },
    },
    mixed: {
        $type: "color",
        $value: {
            colorSpace: "srgb",
            components: [{ $ref: "#/blue/$value/components/0" }, 0, 0],
        },
    },
    broken: { $type: "dimension", $value: "4px" },
};

const doc = readFromMemory({ files: { "tokens.json": JSON.stringify(tokens) } });
const referencesOf = (path: string) => {
    const found = token(doc, path);
    if (!found) throw new Error(`no token ${path}`);
    return references(found);
};

describe("references", () => {
    it("is empty for a value with no references", () => {
        expect(referencesOf("plain")).toStrictEqual([]);
    });

    it("finds a whole value written as a reference at the top of the value", () => {
        expect(referencesOf("accent")).toStrictEqual([{ at: [], ref: { alias: "red" } }]);
    });

    it("finds each part of a composite written as a reference, in the value's order", () => {
        expect(referencesOf("border")).toStrictEqual([
            { at: ["color"], ref: { alias: "red" } },
            { at: ["width"], ref: { alias: "thin" } },
        ]);
    });

    it("places a part by the value as read, so a single shadow is the first in a list", () => {
        expect(referencesOf("lone")).toStrictEqual([{ at: [0, "color"], ref: { alias: "red" } }]);
    });

    it("finds a reference standing for a whole item of a list, and parts inside other items", () => {
        expect(referencesOf("layered")).toStrictEqual([
            { at: [0], ref: { alias: "lone" } },
            { at: [1, "offsetX"], ref: { alias: "thin" } },
        ]);
    });

    it("finds a gradient stop's color and position", () => {
        expect(referencesOf("fade")).toStrictEqual([
            { at: [0, "color"], ref: { alias: "red" } },
            { at: [1, "color"], ref: { alias: "blue" } },
            { at: [1, "position"], ref: { alias: "half" } },
        ]);
    });

    it("finds an item of a dash pattern", () => {
        expect(referencesOf("dash")).toStrictEqual([
            { at: ["dashArray", 0], ref: { alias: "thin" } },
        ]);
    });

    it("finds typography parts", () => {
        expect(referencesOf("body")).toStrictEqual([
            { at: ["fontFamily"], ref: { alias: "family" } },
            { at: ["lineHeight"], ref: { alias: "half" } },
        ]);
    });

    it("finds a JSON Pointer anywhere in a value, such as one component of a color", () => {
        expect(referencesOf("mixed")).toStrictEqual([
            { at: ["components", 0], ref: { pointer: "#/blue/$value/components/0" } },
        ]);
    });

    it("is empty for a token whose value could not be read", () => {
        expect(referencesOf("broken")).toStrictEqual([]);
    });
});
