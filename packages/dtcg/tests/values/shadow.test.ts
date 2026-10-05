import { describe, expect, it } from "vitest";
import { parseShadow } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseShadow(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseShadow(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

function ignored(raw: unknown) {
    const result = parseShadow(raw, ["$value"]);
    return (result.ignored ?? []).map(({ path, detail }) => ({ path, detail }));
}

const rem = (value: number) => ({ value, unit: "rem" });
const black = (alpha: number) => ({ colorSpace: "srgb", components: [0, 0, 0], alpha });
const layer = {
    color: black(0.5),
    offsetX: rem(0.5),
    offsetY: rem(0.5),
    blur: rem(1.5),
    spread: rem(0),
};

describe("parseShadow", () => {
    describe("reads", () => {
        it("one shadow as a list of one, with inset filled in as false (Format 9.6)", () => {
            expect(read(layer)).toStrictEqual([{ ...layer, inset: false }]);
        });

        it("an inner shadow, keeping inset as written, as spec example 54 does", () => {
            const inner = { ...layer, inset: true };
            expect(read(inner)).toStrictEqual([inner]);
        });

        it("a list of shadows, in order", () => {
            const second = { ...layer, color: black(0.2), inset: true };
            expect(read([layer, second])).toStrictEqual([{ ...layer, inset: false }, second]);
        });

        it("references to shadow tokens mixed with shadows, as spec example 54 does", () => {
            const middle = { ...layer, color: "{brand.accent}" };
            expect(read(["{base.shadow}", middle, "{highlight.shadow}"])).toStrictEqual([
                { alias: "base.shadow" },
                { ...middle, color: { alias: "brand.accent" }, inset: false },
                { alias: "highlight.shadow" },
            ]);
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{shadow.card}")).toStrictEqual({ alias: "shadow.card" });
        });

        it("reads a JSON Pointer in place of inset", () => {
            expect(
                read({ ...layer, inset: { $ref: "#/shadow/inner/$value/inset" } }),
            ).toMatchObject([{ inset: { pointer: "#/shadow/inner/$value/inset" } }]);
        });
    });

    describe("refuses", () => {
        it("an empty list", () => {
            expect(details([])).toStrictEqual([
                { path: ["$value"], detail: { type: "shadow", reason: "no-shadows" } },
            ]);
        });

        it.for(["0 1px 2px black", 1, null])("%j, which is not a shadow", (raw) => {
            expect(details(raw)).toStrictEqual([
                { path: ["$value"], detail: { type: "shadow", reason: "wrong-shape", value: raw } },
            ]);
        });

        it.for(["color", "offsetX", "offsetY", "blur", "spread"])("a shadow with no %s", (part) => {
            const raw: Record<string, unknown> = { ...layer };
            delete raw[part];
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value", part],
                    detail: { type: "shadow", reason: "missing-property", property: part },
                },
            ]);
        });

        it.for(["true", 1, null])("inset %j, which is not true or false", (inset) => {
            expect(details({ ...layer, inset })).toStrictEqual([
                {
                    path: ["$value", "inset"],
                    detail: { type: "shadow", reason: "not-a-boolean", value: inset },
                },
            ]);
        });

        it("a bad part in the second shadow of a list, at its full path", () => {
            expect(details([layer, { ...layer, blur: "4px" }])).toStrictEqual([
                {
                    path: ["$value", 1, "blur"],
                    detail: { type: "dimension", reason: "string-with-unit", value: "4px" },
                },
            ]);
        });

        it("something in a list that is neither a shadow nor a reference", () => {
            expect(details([layer, 42])).toStrictEqual([
                {
                    path: ["$value", 1],
                    detail: { type: "shadow", reason: "wrong-shape", value: 42 },
                },
            ]);
        });
    });

    describe("sets aside a property its type does not define, and reads the rest", () => {
        it("a part the spec does not define", () => {
            const raw = { ...layer, opacity: 0.5 };
            expect(read(raw)).toStrictEqual(read(layer));
            expect(ignored(raw)).toStrictEqual([
                { path: ["$value", "opacity"], detail: { type: "shadow", property: "opacity" } },
            ]);
        });

        it("a part's own property, in the second shadow of a list, at its full path", () => {
            const raw = [layer, { ...layer, color: { ...layer.color, name: "ink" } }];
            expect(read(raw)).toStrictEqual(read([layer, layer]));
            expect(ignored(raw)).toStrictEqual([
                {
                    path: ["$value", 1, "color", "name"],
                    detail: { type: "color", property: "name" },
                },
            ]);
        });

        it("a property set aside beside a part that fails", () => {
            const raw = { ...layer, blur: "4px", opacity: 0.5 };
            expect(details(raw).map(({ path }) => path)).toStrictEqual([["$value", "blur"]]);
            expect(ignored(raw)).toStrictEqual([
                { path: ["$value", "opacity"], detail: { type: "shadow", property: "opacity" } },
            ]);
        });
    });
});
