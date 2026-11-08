import { describe, expect, it } from "vitest";
import { parsing } from "./parsing.js";

const { read, refuses } = parsing("gradient");

const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const red = { colorSpace: "srgb", components: [1, 0, 0] };
const withAlpha = (color: object) => ({ ...color, alpha: 1 });

describe("parseValue, gradient", () => {
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
                {
                    color: { syntax: "curly-brace", path: "brand-primary" },
                    position: { syntax: "curly-brace", path: "position-end" },
                },
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
                { syntax: "curly-brace", path: "gradient.start-stop" },
                { color: withAlpha(red), position: 0.333 },
                { syntax: "curly-brace", path: "gradient.end-stop" },
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
    });

    describe("refuses", () => {
        it("an empty list", () => {
            refuses([], [], { reason: "no-gradient-stops" });
        });

        it.for([{ color: red, position: 0 }, "linear-gradient(blue, red)", null])(
            "%j, which is not a list of stops, since spec 9.7 requires a list even for one stop",
            (raw) => {
                refuses(raw, [], { reason: "wrong-shape", value: raw });
            },
        );

        it.for(["color", "position"])("a stop with no %s", (part) => {
            const stop: Record<string, unknown> = { color: red, position: 0 };
            delete stop[part];
            refuses([stop], [0, part], { reason: "missing-property", property: part });
        });

        it("a position that is not a number", () => {
            refuses([{ color: red, position: "50%" }], [0, "position"], {
                type: "number",
                reason: "not-a-number",
                value: "50%",
            });
        });
    });
});
