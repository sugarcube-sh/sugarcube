import { describe, expect, it } from "vitest";
import type { ParseOptions } from "../../src/index.js";
import { parseValue } from "../../src/values.js";

const lenient: ParseOptions = { ignoreUnknownProperties: true };

function read(raw: unknown, options?: ParseOptions) {
    const result = parseValue("shadow", raw, { jsonPath: ["$value"], ...options });
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown, options?: ParseOptions) {
    const result = parseValue("shadow", raw, { jsonPath: ["$value"], ...options });
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ jsonPath, detail }) => ({ jsonPath, detail }));
}

function ignored(raw: unknown, options?: ParseOptions) {
    const result = parseValue("shadow", raw, { jsonPath: ["$value"], ...options });
    return result.ignored.map(({ jsonPath, detail }) => ({ jsonPath, detail }));
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

describe("parseValue, shadow", () => {
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
                { syntax: "curly-brace", path: "base.shadow" },
                { ...middle, color: { syntax: "curly-brace", path: "brand.accent" }, inset: false },
                { syntax: "curly-brace", path: "highlight.shadow" },
            ]);
        });

        it("reads a reference to a whole token in curly brace syntax", () => {
            expect(read("{shadow.card}")).toStrictEqual({
                syntax: "curly-brace",
                path: "shadow.card",
            });
        });

        it("reads a JSON Pointer in place of inset", () => {
            expect(
                read({ ...layer, inset: { $ref: "#/shadow/inner/$value/inset" } }),
            ).toMatchObject([
                { inset: { syntax: "json-pointer", pointer: "#/shadow/inner/$value/inset" } },
            ]);
        });
    });

    describe("refuses", () => {
        it("a curly-brace reference as inset, where a JSON Pointer can stand", () => {
            expect(details({ ...layer, inset: "{shadow.inset}" })).toStrictEqual([
                {
                    jsonPath: ["$value", "inset"],
                    detail: {
                        type: "shadow",
                        reason: "curly-brace-not-allowed-here",
                        reference: "{shadow.inset}",
                    },
                },
            ]);
        });

        it("an empty list", () => {
            expect(details([])).toStrictEqual([
                { jsonPath: ["$value"], detail: { type: "shadow", reason: "no-shadows" } },
            ]);
        });

        it.for(["0 1px 2px black", 1, null])("%j, which is not a shadow", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    jsonPath: ["$value"],
                    detail: { type: "shadow", reason: "wrong-shape", value: raw },
                },
            ]);
        });

        it.for(["color", "offsetX", "offsetY", "blur", "spread"])("a shadow with no %s", (part) => {
            const raw: Record<string, unknown> = { ...layer };
            delete raw[part];
            expect(details(raw)).toStrictEqual([
                {
                    jsonPath: ["$value", part],
                    detail: { type: "shadow", reason: "missing-property", property: part },
                },
            ]);
        });

        it.for(["true", 1, null])("inset %j, which is not true or false", (inset) => {
            expect(details({ ...layer, inset })).toStrictEqual([
                {
                    jsonPath: ["$value", "inset"],
                    detail: { type: "shadow", reason: "not-a-boolean", value: inset },
                },
            ]);
        });

        it("a bad part in the second shadow of a list, at its full path", () => {
            expect(details([layer, { ...layer, blur: "4px" }])).toStrictEqual([
                {
                    jsonPath: ["$value", 1, "blur"],
                    detail: {
                        type: "dimension",
                        reason: "string-with-unit",
                        value: "4px",
                        asObject: { value: 4, unit: "px" },
                    },
                },
            ]);
        });

        it("something in a list that is neither a shadow nor a reference", () => {
            expect(details([layer, 42])).toStrictEqual([
                {
                    jsonPath: ["$value", 1],
                    detail: { type: "shadow", reason: "wrong-shape", value: 42 },
                },
            ]);
        });
    });

    describe("a property its type does not define", () => {
        it("makes the value invalid by default, as Format 9.2 says of a composite", () => {
            const raw = { ...layer, opacity: 0.5 };
            expect(details(raw)).toStrictEqual([
                {
                    jsonPath: ["$value", "opacity"],
                    detail: { type: "shadow", reason: "unknown-property", property: "opacity" },
                },
            ]);
            expect(ignored(raw)).toStrictEqual([]);
        });

        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a part the spec does not define", () => {
                const raw = { ...layer, opacity: 0.5 };
                expect(read(raw, lenient)).toStrictEqual(read(layer, lenient));
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", "opacity"],
                        detail: { type: "shadow", property: "opacity" },
                    },
                ]);
            });

            it("a part's own property, in the second shadow of a list, at its full path", () => {
                const raw = [layer, { ...layer, color: { ...layer.color, name: "ink" } }];
                expect(read(raw, lenient)).toStrictEqual(read([layer, layer], lenient));
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", 1, "color", "name"],
                        detail: { type: "color", property: "name" },
                    },
                ]);
            });

            it("a property set aside beside a part that fails", () => {
                const raw = { ...layer, blur: "4px", opacity: 0.5 };
                expect(details(raw, lenient).map(({ jsonPath }) => jsonPath)).toStrictEqual([
                    ["$value", "blur"],
                ]);
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", "opacity"],
                        detail: { type: "shadow", property: "opacity" },
                    },
                ]);
            });
        });
    });
});
