import { describe, expect, it } from "vitest";
import { lenient, parsing } from "./parsing.js";

const { read, details, ignored, refuses } = parsing("shadow");

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
            refuses({ ...layer, inset: "{shadow.inset}" }, ["inset"], {
                reason: "curly-brace-not-allowed-here",
                reference: "{shadow.inset}",
            });
        });

        it("an empty list", () => {
            refuses([], [], { reason: "no-shadows" });
        });

        it.for(["0 1px 2px black", 1, null])("%j, which is not a shadow", (raw) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });

        it.for(["color", "offsetX", "offsetY", "blur", "spread"])("a shadow with no %s", (part) => {
            const raw: Record<string, unknown> = { ...layer };
            delete raw[part];
            refuses(raw, [part], { reason: "missing-property", property: part });
        });

        it.for(["true", 1, null])("inset %j, which is not true or false", (inset) => {
            refuses({ ...layer, inset }, ["inset"], { reason: "not-a-boolean", value: inset });
        });

        it("a bad part in the second shadow of a list, at its full path", () => {
            refuses([layer, { ...layer, blur: "4px" }], [1, "blur"], {
                type: "dimension",
                reason: "string-with-unit",
                value: "4px",
                unit: "px",
                allowed: ["px", "rem"],
                asObject: { value: 4, unit: "px" },
            });
        });

        it("something in a list that is neither a shadow nor a reference", () => {
            refuses([layer, 42], [1], { reason: "wrong-shape", value: 42 });
        });
    });

    describe("a property its type does not define", () => {
        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
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
