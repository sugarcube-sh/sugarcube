import { describe, expect, it } from "vitest";
import type { Reference } from "../../src/index.js";
import { oneFile } from "../token-files.js";

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
const placed = ({ property, pointsToPath }: Reference) => ({
    ...(property && { property }),
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
            { property: ["color"], pointsToPath: "red" },
            { property: ["width"], pointsToPath: "thin" },
        ]);
    });

    it("places a part by the value as read, so a single shadow is the first in a list", () => {
        expect(referencesOf("lone")).toStrictEqual([
            { property: [0, "color"], pointsToPath: "red" },
        ]);
    });

    it("finds a reference standing for a whole item of a list, and parts inside other items", () => {
        expect(referencesOf("layered")).toStrictEqual([
            { property: [0], pointsToPath: "lone" },
            { property: [1, "offsetX"], pointsToPath: "thin" },
        ]);
    });

    it("finds a gradient stop's color and position", () => {
        expect(referencesOf("fade")).toStrictEqual([
            { property: [0, "color"], pointsToPath: "red" },
            { property: [1, "color"], pointsToPath: "blue" },
            { property: [1, "position"], pointsToPath: "half" },
        ]);
    });

    it("finds an item of a dash pattern", () => {
        expect(referencesOf("dash")).toStrictEqual([
            { property: ["dashArray", 0], pointsToPath: "thin" },
        ]);
    });

    it("finds typography parts", () => {
        expect(referencesOf("body")).toStrictEqual([
            { property: ["fontFamily"], pointsToPath: "family" },
            { property: ["lineHeight"], pointsToPath: "half" },
        ]);
    });

    it("finds a JSON Pointer anywhere in a value, such as one component of a color", () => {
        expect(referencesOf("mixed")).toStrictEqual([
            { property: ["components", 0], pointsToPath: "blue" },
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
            misspelt.getReferencesTo("color.inc").map(({ ownerPaths, pointsToPath, parsed }) => ({
                ownerPaths,
                pointsToPath,
                syntax: parsed.syntax,
            })),
        ).toStrictEqual([
            { ownerPaths: ["text"], pointsToPath: "color.inc", syntax: "json-pointer" },
            { ownerPaths: ["border"], pointsToPath: "color.inc", syntax: "curly-brace" },
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
    const written = (ref: string) => (ref.startsWith("{") ? ref : { $ref: ref });

    function writtenAs(ref: string): Reference {
        const uses = oneFile({ uses: { $type: "number", $value: written(ref) } })
            .getPermutation()
            .getToken("uses");
        const [reference] = uses?.references ?? [];
        if (!reference) throw new Error(`no reference in ${ref}`);
        return reference;
    }

    it.for([
        ["{color.brand}", "{color.primary}"],
        ["{color.brand.500}", "{color.primary.500}"],
        ["{color.branding}", "{color.branding}"],
        ["#/color/brand/500", "#/color/primary/500"],
        ["#/color/brand/500/$value/components/0", "#/color/primary/500/$value/components/0"],
        ["#/space/sm", "#/space/sm"],
        ["other.json#/color/brand", "other.json#/color/brand"],
    ] as const)("moves %s to %s", ([ref, expected]) => {
        expect(writtenAs(ref).applyMoves(moved)).toStrictEqual(written(expected));
    });

    it("follows moves made one after another", () => {
        const twice = [
            { from: "color.brand", to: "color.house" },
            { from: "color.house.500", to: "color.house.550" },
        ];
        expect(writtenAs("{color.brand.500}").applyMoves(twice)).toBe("{color.house.550}");
    });
});
