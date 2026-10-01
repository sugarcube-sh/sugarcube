import { describe, expect, it } from "vitest";
import { parseCubicBezier } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseCubicBezier(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseCubicBezier(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

describe("parseCubicBezier", () => {
    describe("reads", () => {
        it.for([
            { name: "accelerate, spec example 43", curve: [0.5, 0, 1, 1] },
            { name: "decelerate, spec example 43", curve: [0, 0, 0.5, 1] },
            { name: "y values beyond 0 to 1, which overshoot", curve: [0.34, 1.56, 0.64, -0.5] },
        ])("$name", ({ curve }) => {
            expect(read(curve)).toStrictEqual(curve);
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{easing.out}")).toStrictEqual({ alias: "easing.out" });
        });

        it("reads a JSON Pointer in place of one number", () => {
            expect(read([0.5, 0, { $ref: "#/easing/in/$value/2" }, 1])).toStrictEqual([
                0.5,
                0,
                { pointer: "#/easing/in/$value/2" },
                1,
            ]);
        });
    });

    describe("refuses", () => {
        it.for(["ease-in", "cubic-bezier(0.5, 0, 1, 1)", 1, null, { x1: 0 }])(
            "%j, which is not a list",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: { type: "cubicBezier", reason: "wrong-shape", value: raw },
                    },
                ]);
            },
        );

        it.for([
            { curve: [0, 0, 1], count: 3 },
            { curve: [0, 0, 1, 1, 0], count: 5 },
            { curve: [], count: 0 },
        ])("$curve, which is not four numbers", ({ curve, count }) => {
            expect(details(curve)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "cubicBezier", reason: "not-four-numbers", count },
                },
            ]);
        });

        it.for([
            { name: "x1 below 0", curve: [-0.1, 0, 1, 1], index: 0, coordinate: "x1" },
            { name: "x2 above 1", curve: [0, 0, 1.1, 1], index: 2, coordinate: "x2" },
        ])("$name", ({ curve, index, coordinate }) => {
            expect(details(curve)).toStrictEqual([
                {
                    path: ["$value", index],
                    detail: {
                        type: "cubicBezier",
                        reason: "x-out-of-range",
                        value: curve[index],
                        coordinate,
                    },
                },
            ]);
        });

        it("a number written as a string", () => {
            expect(details([0.5, "0", 1, 1])).toStrictEqual([
                {
                    path: ["$value", 1],
                    detail: { type: "cubicBezier", reason: "not-a-number", value: "0" },
                },
            ]);
        });

        it("a curly-brace reference in place of one number", () => {
            expect(details(["{easing.x}", 0, 1, 1])).toStrictEqual([
                {
                    path: ["$value", 0],
                    detail: {
                        type: "cubicBezier",
                        reason: "alias-not-allowed-here",
                        reference: "{easing.x}",
                    },
                },
            ]);
        });
    });
});
