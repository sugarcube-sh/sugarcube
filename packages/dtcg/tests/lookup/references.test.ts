import { describe, expect, it } from "vitest";
import type { Reference, WrittenReference } from "../../src/index.js";
import { oneFile } from "../token-files.js";
import { movedReference } from "../../src/values/references.js";

const color = { colorSpace: "srgb", components: [1, 0, 0] };
const px = (value: number) => ({ value, unit: "px" });

const json = {
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

const tokens = oneFile(json);
const tokenAt = (path: string) => {
    const found = tokens.getPermutation().getToken(path);
    if (!found) throw new Error(`no token ${path}`);
    return found;
};
const placed = ({ writtenInProperty, pointsToPath }: Reference) => ({
    ...(writtenInProperty && { writtenInProperty }),
    pointsToPath,
});
const referencesOf = (path: string) => tokenAt(path).references.map(placed);
const pointsToPathAt = (path: string, property: (string | number)[]) =>
    tokenAt(path).getReferenceAt(property)?.pointsToPath;

describe("a token's references", () => {
    it("is empty for a value with no references", () => {
        expect(referencesOf("plain")).toStrictEqual([]);
    });

    it("finds a whole value written as a reference at the top of the value", () => {
        expect(referencesOf("accent")).toStrictEqual([{ pointsToPath: "red" }]);
    });

    it("finds each part of a composite written as a reference, in the value's order", () => {
        expect(referencesOf("border")).toStrictEqual([
            { writtenInProperty: ["color"], pointsToPath: "red" },
            { writtenInProperty: ["width"], pointsToPath: "thin" },
        ]);
    });

    it("places a part by the value as read, so a single shadow is the first in a list", () => {
        expect(referencesOf("lone")).toStrictEqual([
            { writtenInProperty: [0, "color"], pointsToPath: "red" },
        ]);
    });

    it("finds a reference standing for a whole item of a list, and parts inside other items", () => {
        expect(referencesOf("layered")).toStrictEqual([
            { writtenInProperty: [0], pointsToPath: "lone" },
            { writtenInProperty: [1, "offsetX"], pointsToPath: "thin" },
        ]);
    });

    it("finds a gradient stop's color and position", () => {
        expect(referencesOf("fade")).toStrictEqual([
            { writtenInProperty: [0, "color"], pointsToPath: "red" },
            { writtenInProperty: [1, "color"], pointsToPath: "blue" },
            { writtenInProperty: [1, "position"], pointsToPath: "half" },
        ]);
    });

    it("finds an item of a dash pattern", () => {
        expect(referencesOf("dash")).toStrictEqual([
            { writtenInProperty: ["dashArray", 0], pointsToPath: "thin" },
        ]);
    });

    it("finds typography parts", () => {
        expect(referencesOf("body")).toStrictEqual([
            { writtenInProperty: ["fontFamily"], pointsToPath: "family" },
            { writtenInProperty: ["lineHeight"], pointsToPath: "half" },
        ]);
    });

    it("finds a JSON Pointer anywhere in a value, such as one component of a color", () => {
        expect(referencesOf("mixed")).toStrictEqual([
            { writtenInProperty: ["components", 0], pointsToPath: "blue" },
        ]);
    });

    it("is empty for a token whose value could not be read and writes none", () => {
        expect(referencesOf("broken")).toStrictEqual([]);
    });
});

describe("a reference to nothing", () => {
    it("still names the path it points at, so it can be found and moved", () => {
        const misspelt = oneFile({
            text: { $type: "color", $value: { $ref: "#/color/inc/$value" } },
            border: { $type: "color", $value: "{color.inc}" },
        });
        expect(
            misspelt
                .getReferencesTo("color.inc")
                .map(({ writtenInPaths, pointsToPath, asWritten }) => ({
                    writtenInPaths,
                    pointsToPath,
                    syntax: asWritten.syntax,
                })),
        ).toStrictEqual([
            { writtenInPaths: ["text"], pointsToPath: "color.inc", syntax: "json-pointer" },
            { writtenInPaths: ["border"], pointsToPath: "color.inc", syntax: "curly-brace" },
        ]);
    });
});

describe("getReferenceAt", () => {
    it("finds the reference written at a place in the value", () => {
        expect(pointsToPathAt("border", ["width"])).toBe("thin");
        expect(pointsToPathAt("fade", [1, "position"])).toBe("half");
        expect(pointsToPathAt("mixed", ["components", 0])).toBe("blue");
    });

    it("finds a whole value written as a reference at the top of the value", () => {
        expect(pointsToPathAt("accent", [])).toBe("red");
        expect(tokenAt("accent").getReferenceAt()?.pointsToPath).toBe("red");
    });

    it("finds a reference standing for a whole item of a list", () => {
        expect(pointsToPathAt("layered", [0])).toBe("lone");
    });

    it("finds nothing where the file wrote a value", () => {
        expect(pointsToPathAt("border", ["style"])).toBeUndefined();
        expect(pointsToPathAt("plain", [])).toBeUndefined();
    });

    it("finds nothing at a part when the reference is around it or inside it", () => {
        expect(pointsToPathAt("accent", ["components", 0])).toBeUndefined();
        expect(pointsToPathAt("mixed", [])).toBeUndefined();
    });

    it("finds nothing at a place the value does not have", () => {
        expect(pointsToPathAt("border", ["shade"])).toBeUndefined();
        expect(pointsToPathAt("layered", [5, "color"])).toBeUndefined();
        expect(pointsToPathAt("border", [0])).toBeUndefined();
        expect(pointsToPathAt("layered", ["length"])).toBeUndefined();
    });

    it("finds nothing in a token whose value could not be read", () => {
        expect(pointsToPathAt("broken", [])).toBeUndefined();
    });
});

describe("the rule moved() follows", () => {
    const moved = [{ from: "color.brand", to: "color.primary" }];

    it.for<{ ref: WrittenReference; expected: WrittenReference }>([
        {
            ref: { syntax: "curly-brace", path: "color.brand" },
            expected: { syntax: "curly-brace", path: "color.primary" },
        },
        {
            ref: { syntax: "curly-brace", path: "color.brand.500" },
            expected: { syntax: "curly-brace", path: "color.primary.500" },
        },
        {
            ref: { syntax: "curly-brace", path: "color.branding" },
            expected: { syntax: "curly-brace", path: "color.branding" },
        },
        {
            ref: { syntax: "json-pointer", pointer: "#/color/brand/500" },
            expected: { syntax: "json-pointer", pointer: "#/color/primary/500" },
        },
        {
            ref: { syntax: "json-pointer", pointer: "#/color/brand/500/$value/components/0" },
            expected: {
                syntax: "json-pointer",
                pointer: "#/color/primary/500/$value/components/0",
            },
        },
        {
            ref: { syntax: "json-pointer", pointer: "#/space/sm" },
            expected: { syntax: "json-pointer", pointer: "#/space/sm" },
        },
        {
            ref: { syntax: "json-pointer", pointer: "other.json#/color/brand" },
            expected: { syntax: "json-pointer", pointer: "other.json#/color/brand" },
        },
    ])("moves $ref.path$ref.pointer", ({ ref, expected }) => {
        expect(movedReference(ref, moved)).toStrictEqual(expected);
    });

    it("follows moves made one after another", () => {
        const twice = [
            { from: "color.brand", to: "color.house" },
            { from: "color.house.500", to: "color.house.550" },
        ];
        expect(
            movedReference({ syntax: "curly-brace", path: "color.brand.500" }, twice),
        ).toStrictEqual({
            syntax: "curly-brace",
            path: "color.house.550",
        });
    });
});
