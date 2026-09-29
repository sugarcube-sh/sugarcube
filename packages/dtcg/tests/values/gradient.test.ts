import { describe, expect, it } from "vitest";
import { parseGradient } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseGradient(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseGradient(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const red = { colorSpace: "srgb", components: [1, 0, 0] };
const withAlpha = (color: object) => ({ ...color, alpha: 1 });

describe("parseGradient", () => {
    describe("reads", () => {
        it("blue to red, spec example 55", () => {
            expect(
                read([
                    { color: blue, position: 0 },
                    { color: red, position: 1 },
                ]),
            ).toStrictEqual([
                { color: withAlpha(blue), position: 0 },
                { color: withAlpha(red), position: 1 },
            ]);
        });

        it("a gradient with no stop at 0, spec example 56, left for the renderer to extend", () => {
            const yellow = { colorSpace: "srgb", components: [1, 1, 0] };
            expect(
                read([
                    { color: yellow, position: 0.666 },
                    { color: red, position: 1 },
                ]),
            ).toStrictEqual([
                { color: withAlpha(yellow), position: 0.666 },
                { color: withAlpha(red), position: 1 },
            ]);
        });

        it("references for a stop's color and position, as spec example 57 does", () => {
            expect(read([{ color: "{brand-primary}", position: "{position-end}" }])).toStrictEqual([
                { color: { alias: "brand-primary" }, position: { alias: "position-end" } },
            ]);
        });

        it("references to gradient tokens among the stops, as spec example 57 does", () => {
            expect(
                read([
                    "{gradient.start-stop}",
                    { color: red, position: 0.333 },
                    "{gradient.end-stop}",
                ]),
            ).toStrictEqual([
                { alias: "gradient.start-stop" },
                { color: withAlpha(red), position: 0.333 },
                { alias: "gradient.end-stop" },
            ]);
        });

        it.for([
            { written: 42, read: 1 },
            { written: -99, read: 0 },
            { written: 1.5, read: 1 },
        ])(
            "a position of $written as $read, clamped as spec 9.7 requires",
            ({ written, read: expected }) => {
                expect(read([{ color: red, position: written }])).toMatchObject([
                    { position: expected },
                ]);
            },
        );

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{gradient.brand}")).toStrictEqual({ alias: "gradient.brand" });
        });
    });

    describe("refuses", () => {
        it("an empty list", () => {
            expect(details([])).toStrictEqual([{ path: ["$value"], detail: "no-gradient-stops" }]);
        });

        it.for([{ color: red, position: 0 }, "linear-gradient(blue, red)", null])(
            "%j, which is not a list of stops, since spec 9.7 requires a list even for one stop",
            (raw) => {
                expect(details(raw)).toStrictEqual([{ path: ["$value"], detail: "wrong-shape" }]);
            },
        );

        it.for(["color", "position"])("a stop with no %s", (part) => {
            const stop: Record<string, unknown> = { color: red, position: 0 };
            delete stop[part];
            expect(details([stop])).toStrictEqual([
                { path: ["$value", 0], detail: "missing-property" },
            ]);
        });

        it("a position that is not a number", () => {
            expect(details([{ color: red, position: "50%" }])).toStrictEqual([
                { path: ["$value", 0, "position"], detail: "wrong-shape" },
            ]);
        });

        it("a part the spec does not define", () => {
            expect(details([{ color: red, position: 0, midpoint: 0.5 }])).toStrictEqual([
                { path: ["$value", 0, "midpoint"], detail: "unknown-property" },
            ]);
        });
    });
});
