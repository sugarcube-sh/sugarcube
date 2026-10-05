import { describe, expect, it } from "vitest";
import { type Part, parts, readFromMemory, token } from "../../src/index.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const redRead = { colorSpace: "srgb", components: [1, 0, 0], alpha: 1 };
const px = (value: number) => ({ value, unit: "px" });

const tokens = {
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

const doc = readFromMemory({ files: { "tokens.json": JSON.stringify(tokens) } });
const partsOf = (path: string) => {
    const found = token(doc, path);
    if (!found) throw new Error(`no token ${path}`);
    return parts(found);
};

describe("parts", () => {
    it("gives a simple value as one part, with what it resolved to", () => {
        expect(partsOf("thin")).toStrictEqual({ type: "dimension", at: [], resolved: px(1) });
    });

    it("gives a whole value written as a reference that reference", () => {
        expect(partsOf("accent")).toStrictEqual({
            type: "color",
            at: [],
            resolved: redRead,
            ref: { alias: "red" },
        });
    });

    it("gives each part of a composite, typed, with the reference written there", () => {
        expect(partsOf("edge")).toStrictEqual({
            type: "border",
            at: [],
            resolved: {
                color: redRead,
                width: px(2),
                style: { kind: "keyword", keyword: "solid" },
            },
            color: { type: "color", at: ["color"], resolved: redRead, ref: { alias: "red" } },
            width: { type: "dimension", at: ["width"], resolved: px(2) },
            style: {
                type: "strokeStyle",
                at: ["style"],
                resolved: { kind: "keyword", keyword: "solid" },
            },
        });
    });

    it("gives a JSON Pointer written at a part as its reference", () => {
        const border = partsOf("pointed");
        expect(border?.type === "border" && border.color.ref).toStrictEqual({
            pointer: "#/red/$value",
        });
        expect(border?.type === "border" && border.width.ref).toStrictEqual({ alias: "thin" });
    });

    it("leaves a pointer inside a part, such as at one color component, in what it resolved to", () => {
        expect(partsOf("mixed")).toStrictEqual({ type: "color", at: [], resolved: redRead });
    });

    it("gives a shadow its layers, a single shadow as a list of one", () => {
        const shadow = partsOf("lone");
        expect(shadow?.type === "shadow" && shadow.layers).toStrictEqual([
            {
                at: [0],
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
                    at: [0, "color"],
                    resolved: redRead,
                    ref: { alias: "red" },
                },
                offsetX: { type: "dimension", at: [0, "offsetX"], resolved: px(0) },
                offsetY: { type: "dimension", at: [0, "offsetY"], resolved: px(1) },
                blur: { type: "dimension", at: [0, "blur"], resolved: px(2) },
                spread: { type: "dimension", at: [0, "spread"], resolved: px(0) },
            },
        ]);
    });

    it("gives a layer written as a reference to a shadow token that reference, and its parts", () => {
        const shadow = partsOf("layered");
        if (shadow?.type !== "shadow") throw new Error("not a shadow");
        const [first, second] = shadow.layers;
        expect(first?.ref).toStrictEqual({ alias: "lone" });
        expect(first?.color).toStrictEqual({ type: "color", at: [0, "color"], resolved: redRead });
        expect(second?.ref).toBeUndefined();
        expect(second?.resolved.inset).toBe(true);
        expect(second?.offsetX.ref).toStrictEqual({ alias: "thin" });
    });

    it("gives a gradient its stops, each with its color and position", () => {
        const gradient = partsOf("fade");
        if (gradient?.type !== "gradient") throw new Error("not a gradient");
        expect(gradient.stops.map(({ color, position }) => [color.ref, position])).toStrictEqual([
            [undefined, { type: "number", at: [0, "position"], resolved: 0 }],
            [
                { alias: "red" },
                { type: "number", at: [1, "position"], resolved: 0.5, ref: { alias: "half" } },
            ],
        ]);
    });

    it("gives a dash pattern its lengths, and a keyword none", () => {
        const dash = partsOf("dash");
        expect(dash?.type === "strokeStyle" && "dashArray" in dash && dash.dashArray).toStrictEqual(
            [
                {
                    type: "dimension",
                    at: ["dashArray", 0],
                    resolved: px(1),
                    ref: { alias: "thin" },
                },
                { type: "dimension", at: ["dashArray", 1], resolved: px(2) },
            ],
        );
        const plain = partsOf("plain");
        expect(plain?.type === "strokeStyle" && "dashArray" in plain).toBe(false);
    });

    it("gives typography its five parts, in the spec's order", () => {
        const typography = partsOf("body");
        if (typography?.type !== "typography") throw new Error("not typography");
        expect(typePartsOf(typography)).toStrictEqual([
            ["fontFamily", "fontFamily"],
            ["fontSize", "dimension"],
            ["fontWeight", "fontWeight"],
            ["letterSpacing", "dimension"],
            ["lineHeight", "number"],
        ]);
        expect(typography.fontFamily.ref).toStrictEqual({ alias: "family" });
        expect(typography.lineHeight).toStrictEqual({
            type: "number",
            at: ["lineHeight"],
            resolved: 0.5,
            ref: { alias: "half" },
        });
    });

    it("gives every composite its parts, with their types, in the spec's order", () => {
        const motion = partsOf("motion");
        const edge = partsOf("edge");
        const shadow = partsOf("lone");
        const gradient = partsOf("fade");
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
        expect(partsOf("broken")).toBeUndefined();
    });
});

function typePartsOf(part: Part | object | undefined): [string, unknown][] {
    return Object.entries(part ?? {}).flatMap(([name, each]) =>
        typeof each === "object" && each !== null && "type" in each ? [[name, each.type]] : [],
    );
}
