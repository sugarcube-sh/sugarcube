import type { JsonValue } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { parseParts, addFieldItem, removeFieldItem } from "../../src/controllers/parts";
import { parseField } from "../../src/controllers/value-field";

const px = (value: number) => ({ value, unit: "px" });
const layer = { color: "#0000001a", offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) };

describe("parseParts", () => {
    it("gives a shadow layer's parts, its optional inset among them", () => {
        expect(
            parseParts("shadow", { ...layer, inset: true })?.map(({ name, type }) => [name, type]),
        ).toEqual([
            ["color", "color"],
            ["offsetX", "dimension"],
            ["offsetY", "dimension"],
            ["blur", "dimension"],
            ["spread", "dimension"],
            ["inset", "boolean"],
        ]);
    });

    it("gives nothing for a value it can't show exactly", () => {
        expect(parseParts("shadow", { ...layer, glow: true })).toBeUndefined();
        expect(parseParts("gradient", "{gradient.stop}")).toBeUndefined();
    });
});

describe("addFieldItem and removeFieldItem", () => {
    const list = (value: JsonValue) => {
        const field = parseField("shadow", value);
        if (field.kind !== "list") throw new Error(field.kind);
        return field;
    };
    const dashes = (value: JsonValue) => {
        const field = parseField("strokeStyle", value);
        if (field.kind !== "dashes") throw new Error(field.kind);
        return field;
    };

    it("adds a copy of the last item, making a single shadow a list", () => {
        expect(addFieldItem(list(layer))).toEqual([layer, layer]);
        expect(addFieldItem(list([layer, "{shadow.sm}"]))).toEqual([
            layer,
            "{shadow.sm}",
            "{shadow.sm}",
        ]);
        expect(addFieldItem(dashes({ dashArray: [px(4)], lineCap: "round" }))).toEqual({
            dashArray: [px(4), px(4)],
            lineCap: "round",
        });
    });

    it("takes one out, keeping a list a list", () => {
        expect(removeFieldItem(list([layer, "{shadow.sm}"]), 0)).toEqual(["{shadow.sm}"]);
        expect(removeFieldItem(dashes({ dashArray: [px(4), px(8)], lineCap: "butt" }), 1)).toEqual({
            dashArray: [px(4)],
            lineCap: "butt",
        });
    });
});
