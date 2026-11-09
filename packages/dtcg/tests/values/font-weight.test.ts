import { describe, expect, it } from "vitest";
import { fontWeightKeywords } from "../../src/values.js";
import { parsing } from "./parsing.js";

const { read, refuses } = parsing("fontWeight");

describe("parseValue, fontWeight", () => {
    describe("reads", () => {
        it.for([1, 350, 400, 1000, 450.5])("the number %s", (weight) => {
            expect(read(weight)).toBe(weight);
        });

        it.for(Object.entries(fontWeightKeywords))("the keyword %s as %s", ([keyword, weight]) => {
            expect(read(keyword)).toBe(weight);
        });
    });

    describe("refuses", () => {
        it.for([0, 1001, -100])("%s, outside 1 to 1000", (weight) => {
            refuses(weight, [], { reason: "font-weight-out-of-range", value: weight });
        });

        it.for(["Bold", "BOLD", "semibold", "700", "extra bold"])(
            "%j, which is not a keyword the spec defines, since keywords are case-sensitive",
            (raw) => {
                refuses(raw, [], { reason: "unknown-font-weight-keyword", value: raw });
            },
        );

        it.for([null, true, [700], { weight: 700 }])("%j, which is not a weight", (raw) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });
    });
});
