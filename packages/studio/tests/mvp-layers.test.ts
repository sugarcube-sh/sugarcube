import { describe, expect, it } from "vitest";
import { emptyLayer, layerFields, readLayers, writeLayers } from "../src/mvp/composite";
import { readField } from "../src/mvp/value-field";

const SHADOW = {
    color: "#000000",
    offsetX: { value: 0, unit: "px" },
    offsetY: { value: 4, unit: "px" },
    blur: { value: 6, unit: "px" },
    spread: { value: 0, unit: "px" },
};

const STOPS = [
    { color: "#000000", position: 0 },
    { color: "#ffffff", position: 1 },
];

describe("readLayers", () => {
    it("reads a shadow authored as one object as a single layer", () => {
        expect(readLayers("shadow", SHADOW)).toEqual([SHADOW]);
    });

    it("reads a shadow authored as a list as its layers", () => {
        expect(readLayers("shadow", [SHADOW, SHADOW])).toHaveLength(2);
    });

    it("reads a gradient as its stops", () => {
        expect(readLayers("gradient", STOPS)).toEqual(STOPS);
    });

    it("has nothing to say about a type that is not layered", () => {
        expect(readLayers("color", "#fff")).toBeUndefined();
        expect(readLayers("border", { color: "#000" })).toBeUndefined();
    });

    it("has nothing to say about a reference", () => {
        expect(readLayers("shadow", "{shadow.raised}")).toBeUndefined();
    });
});

describe("writeLayers", () => {
    it("keeps a one-layer shadow as the object it was authored as", () => {
        expect(writeLayers("shadow", SHADOW, [SHADOW])).toEqual(SHADOW);
    });

    it("promotes a shadow to a list once a second layer is added", () => {
        expect(writeLayers("shadow", SHADOW, [SHADOW, SHADOW])).toHaveLength(2);
    });

    it("keeps a shadow authored as a list as a list, even at one layer", () => {
        expect(writeLayers("shadow", [SHADOW], [SHADOW])).toEqual([SHADOW]);
    });

    it("always writes a gradient as a list", () => {
        expect(writeLayers("gradient", STOPS, [STOPS[0]])).toEqual([STOPS[0]]);
    });
});

describe("layerFields and emptyLayer", () => {
    it("names a shadow's parts", () => {
        expect(layerFields("shadow").map((f) => f.key)).toEqual([
            "color",
            "offsetX",
            "offsetY",
            "blur",
            "spread",
        ]);
    });

    it("names a gradient stop's parts", () => {
        expect(layerFields("gradient").map((f) => f.key)).toEqual(["color", "position"]);
    });

    it("makes a new layer with every part the type requires", () => {
        expect(Object.keys(emptyLayer("shadow") as object)).toEqual([
            "color",
            "offsetX",
            "offsetY",
            "blur",
            "spread",
        ]);
        expect(emptyLayer("gradient")).toEqual({ color: "", position: 0 });
    });
});

describe("readField, on a layered composite", () => {
    it("summarises a single shadow as its parts", () => {
        expect(readField("shadow", SHADOW)).toEqual({
            text: "#000000 0px 4px 6px 0px",
            editable: false,
        });
    });

    it("counts the layers rather than printing them all", () => {
        expect(readField("shadow", [SHADOW, SHADOW]).text).toBe("2 shadows");
        expect(readField("gradient", STOPS).text).toBe("2 stops");
    });
});
