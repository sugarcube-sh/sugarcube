import { describe, expect, it } from "vitest";
import type { Part } from "../../src/index.js";
import { oneFile } from "../token-files.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const redRead = { colorSpace: "srgb", components: [1, 0, 0], alpha: 1 };
const px = (value: number) => ({ value, unit: "px" });

const json = {
    red: { $type: "color", $value: red },
    thin: { $type: "dimension", $value: px(1) },
    half: { $type: "number", $value: 0.5 },
    family: { $type: "fontFamily", $value: "Inter" },
    accent: { $type: "color", $value: "{red}" },
    edge: { $type: "border", $value: { color: "{red}", width: px(2), style: "solid" } },
    pointed: {
        $type: "border",
        $value: { color: { $ref: "#/red/$value" }, width: "{thin}", style: "dotted" },
    },
    lone: {
        $type: "shadow",
        $value: { color: "{red}", offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) },
    },
    layered: {
        $type: "shadow",
        $value: [
            "{lone}",
            {
                color: red,
                offsetX: "{thin}",
                offsetY: px(1),
                blur: px(2),
                spread: px(0),
                inset: true,
            },
        ],
    },
    fade: {
        $type: "gradient",
        $value: [
            { color: red, position: 0 },
            { color: "{red}", position: "{half}" },
        ],
    },
    dash: { $type: "strokeStyle", $value: { dashArray: ["{thin}", px(2)], lineCap: "round" } },
    plain: { $type: "strokeStyle", $value: "dashed" },
    motion: {
        $type: "transition",
        $value: {
            duration: { value: 200, unit: "ms" },
            delay: { value: 0, unit: "ms" },
            timingFunction: [0.4, 0, 0.2, 1],
        },
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
        $value: { colorSpace: "srgb", components: [{ $ref: "#/red/$value/components/0" }, 0, 0] },
    },
    broken: { $type: "dimension", $value: "4px" },
};

const tokens = oneFile(json);
const partsOfPath = (path: string) => {
    const found = tokens.getPermutation().getToken(path);
    if (!found) throw new Error(`no token ${path}`);
    return found.parts;
};

describe("token.parts", () => {
    it("gives a simple value as one part, with what it resolved to", () => {
        expect(partsOfPath("thin")).toStrictEqual({ type: "dimension", resolved: px(1) });
    });

    it("gives a whole value written as a reference that reference", () => {
        expect(partsOfPath("accent")).toStrictEqual({
            type: "color",
            resolved: redRead,
            ref: expect.objectContaining({ asWritten: { syntax: "curly-brace", path: "red" } }),
        });
    });

    it("gives each part of a composite, typed, with the reference written there", () => {
        expect(partsOfPath("edge")).toStrictEqual({
            type: "border",
            resolved: {
                color: redRead,
                width: px(2),
                style: { kind: "keyword", keyword: "solid" },
            },
            color: {
                type: "color",
                property: ["color"],
                resolved: redRead,
                ref: expect.objectContaining({ asWritten: { syntax: "curly-brace", path: "red" } }),
            },
            width: { type: "dimension", property: ["width"], resolved: px(2) },
            style: {
                type: "strokeStyle",
                property: ["style"],
                resolved: { kind: "keyword", keyword: "solid" },
            },
        });
    });

    it("gives a JSON Pointer written at a part as its reference", () => {
        const border = partsOfPath("pointed");
        expect(border?.type === "border" && border.color.ref?.asWritten).toStrictEqual({
            syntax: "json-pointer",
            pointer: "#/red/$value",
        });
        expect(border?.type === "border" && border.width.ref?.asWritten).toStrictEqual({
            syntax: "curly-brace",
            path: "thin",
        });
    });

    it("leaves a pointer inside a part, such as at one color component, in what it resolved to", () => {
        expect(partsOfPath("mixed")).toStrictEqual({ type: "color", resolved: redRead });
    });

    it("gives a shadow its layers, a single shadow as a list of one", () => {
        const shadow = partsOfPath("lone");
        expect(shadow?.type === "shadow" && shadow.layers).toStrictEqual([
            {
                property: [0],
                resolved: {
                    color: redRead,
                    offsetX: px(0),
                    offsetY: px(1),
                    blur: px(2),
                    spread: px(0),
                    inset: false,
                },
                color: {
                    type: "color",
                    property: [0, "color"],
                    resolved: redRead,
                    ref: expect.objectContaining({
                        asWritten: { syntax: "curly-brace", path: "red" },
                    }),
                },
                offsetX: { type: "dimension", property: [0, "offsetX"], resolved: px(0) },
                offsetY: { type: "dimension", property: [0, "offsetY"], resolved: px(1) },
                blur: { type: "dimension", property: [0, "blur"], resolved: px(2) },
                spread: { type: "dimension", property: [0, "spread"], resolved: px(0) },
            },
        ]);
    });

    it("gives a layer written as a reference to a shadow token that reference, and its parts", () => {
        const shadow = partsOfPath("layered");
        if (shadow?.type !== "shadow") throw new Error("not a shadow");
        const [first, second] = shadow.layers;
        expect(first?.ref).toMatchObject({ asWritten: { syntax: "curly-brace", path: "lone" } });
        expect(first?.color).toStrictEqual({
            type: "color",
            property: [0, "color"],
            resolved: redRead,
        });
        expect(second?.ref).toBeUndefined();
        expect(second?.resolved.inset).toBe(true);
        expect(second?.offsetX.ref).toMatchObject({
            asWritten: { syntax: "curly-brace", path: "thin" },
        });
    });

    it("gives a gradient its stops, each with its color and position", () => {
        const gradient = partsOfPath("fade");
        if (gradient?.type !== "gradient") throw new Error("not a gradient");
        expect(gradient.stops.map(({ color, position }) => [color.ref, position])).toStrictEqual([
            [undefined, { type: "number", property: [0, "position"], resolved: 0 }],
            [
                expect.objectContaining({ asWritten: { syntax: "curly-brace", path: "red" } }),
                {
                    type: "number",
                    property: [1, "position"],
                    resolved: 0.5,
                    ref: expect.objectContaining({
                        asWritten: { syntax: "curly-brace", path: "half" },
                    }),
                },
            ],
        ]);
    });

    it("gives a dash pattern its lengths, and a keyword none", () => {
        const dash = partsOfPath("dash");
        expect(dash?.type === "strokeStyle" && "dashArray" in dash && dash.dashArray).toStrictEqual(
            [
                {
                    type: "dimension",
                    property: ["dashArray", 0],
                    resolved: px(1),
                    ref: expect.objectContaining({
                        asWritten: { syntax: "curly-brace", path: "thin" },
                    }),
                },
                { type: "dimension", property: ["dashArray", 1], resolved: px(2) },
            ],
        );
        const plain = partsOfPath("plain");
        expect(plain?.type === "strokeStyle" && "dashArray" in plain).toBe(false);
    });

    it("gives typography its five parts, in the spec's order", () => {
        const typography = partsOfPath("body");
        if (typography?.type !== "typography") throw new Error("not typography");
        expect(typePartsOf(typography)).toStrictEqual([
            ["fontFamily", "fontFamily"],
            ["fontSize", "dimension"],
            ["fontWeight", "fontWeight"],
            ["letterSpacing", "dimension"],
            ["lineHeight", "number"],
        ]);
        expect(typography.fontFamily.ref).toMatchObject({
            asWritten: { syntax: "curly-brace", path: "family" },
        });
        expect(typography.lineHeight).toStrictEqual({
            type: "number",
            property: ["lineHeight"],
            resolved: 0.5,
            ref: expect.objectContaining({ asWritten: { syntax: "curly-brace", path: "half" } }),
        });
    });

    it("gives every composite its parts, with their types, in the spec's order", () => {
        const motion = partsOfPath("motion");
        const edge = partsOfPath("edge");
        const shadow = partsOfPath("lone");
        const gradient = partsOfPath("fade");
        if (
            motion?.type !== "transition" ||
            edge?.type !== "border" ||
            shadow?.type !== "shadow" ||
            gradient?.type !== "gradient"
        )
            throw new Error("wrong types");
        expect(typePartsOf(motion)).toStrictEqual([
            ["duration", "duration"],
            ["delay", "duration"],
            ["timingFunction", "cubicBezier"],
        ]);
        expect(typePartsOf(edge)).toStrictEqual([
            ["color", "color"],
            ["width", "dimension"],
            ["style", "strokeStyle"],
        ]);
        expect(typePartsOf(shadow.layers[0])).toStrictEqual([
            ["color", "color"],
            ["offsetX", "dimension"],
            ["offsetY", "dimension"],
            ["blur", "dimension"],
            ["spread", "dimension"],
        ]);
        expect(typePartsOf(gradient.stops[0])).toStrictEqual([
            ["color", "color"],
            ["position", "number"],
        ]);
    });

    it("is undefined for a token whose value could not be read", () => {
        expect(partsOfPath("broken")).toBeUndefined();
    });
});

function typePartsOf(part: Part | object | undefined): [string, unknown][] {
    return Object.entries(part ?? {}).flatMap(([name, each]) =>
        typeof each === "object" && each !== null && "type" in each ? [[name, each.type]] : [],
    );
}
