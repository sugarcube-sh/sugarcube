import { describe, expect, it } from "vitest";
import { parsing } from "./parsing.js";

const { read, refuses } = parsing("cubicBezier");

describe("parseValue, cubicBezier", () => {
    describe("reads", () => {
        it.for([
            { name: "accelerate, spec example 43", curve: [0.5, 0, 1, 1] },
            { name: "decelerate, spec example 43", curve: [0, 0, 0.5, 1] },
            { name: "y values beyond 0 to 1, which overshoot", curve: [0.34, 1.56, 0.64, -0.5] },
        ])("$name", ({ curve }) => {
            expect(read(curve)).toStrictEqual(curve);
        });

        it("reads a reference to a whole token in curly brace syntax", () => {
            expect(read("{easing.out}")).toStrictEqual({
                syntax: "curly-brace",
                path: "easing.out",
            });
        });

        it("reads a JSON Pointer in place of one number", () => {
            expect(read([0.5, 0, { $ref: "#/easing/in/$value/2" }, 1])).toStrictEqual([
                0.5,
                0,
                { syntax: "json-pointer", pointer: "#/easing/in/$value/2" },
                1,
            ]);
        });
    });

    describe("refuses", () => {
        it.for(["ease-in", "cubic-bezier(0.5, 0, 1, 1)", 1, null, { x1: 0 }])(
            "%j, which is not a list",
            (raw) => {
                refuses(raw, [], { reason: "wrong-shape", value: raw });
            },
        );

        it.for([
            { curve: [0, 0, 1], count: 3 },
            { curve: [0, 0, 1, 1, 0], count: 5 },
            { curve: [], count: 0 },
        ])("$curve, which is not four numbers", ({ curve, count }) => {
            refuses(curve, [], { reason: "not-four-numbers", count });
        });

        it.for([
            { name: "x1 below 0", curve: [-0.1, 0, 1, 1], index: 0, coordinate: "x1" },
            { name: "x2 above 1", curve: [0, 0, 1.1, 1], index: 2, coordinate: "x2" },
        ])("$name", ({ curve, index, coordinate }) => {
            refuses(curve, [index], { reason: "x-out-of-range", value: curve[index], coordinate });
        });

        it("a number written as a string", () => {
            refuses([0.5, "0", 1, 1], [1], { reason: "not-a-number", value: "0" });
        });

        it("a curly-brace reference in place of one number", () => {
            refuses(["{easing.x}", 0, 1, 1], [0], {
                reason: "curly-brace-not-allowed-here",
                reference: "{easing.x}",
            });
        });
    });
});
