import { describe, expect, it } from "vitest";
import { extensionReader, isJsonObject } from "../../src/values.js";

const messages = {
    "missing-property": ({ name }: { name: string }) => `the range needs \`${name}\``,
    "no-steps": () => "the scale needs at least one step",
};

describe("extensionReader", () => {
    it("reads a literal value", () => {
        const reader = extensionReader<typeof messages>();
        expect(reader.read("dimension", { value: 1, unit: "rem" }, ["min"])).toStrictEqual({
            value: 1,
            unit: "rem",
        });
        expect(reader.result("done")).toStrictEqual({ ok: true, value: "done" });
    });

    it("gives nothing for a value that does not fit, and keeps the parser's error", () => {
        const reader = extensionReader<typeof messages>();
        expect(reader.read("dimension", "16px", ["min"])).toBeUndefined();
        const result = reader.result(undefined);
        expect(
            result.ok ? [] : result.errors.map((each) => ("detail" in each ? each.detail : each)),
        ).toEqual([{ type: "dimension", reason: "string-with-unit", value: "16px" }]);
    });

    it("keeps what a value sets aside, beside the result", () => {
        const reader = extensionReader<typeof messages>();
        expect(
            reader.read("dimension", { value: 1, unit: "rem", fluid: true }, ["min"]),
        ).toStrictEqual({
            value: 1,
            unit: "rem",
        });
        const result = reader.result("done");
        expect(result.ok).toBe(true);
        expect(result.ignored?.map(({ path, detail }) => ({ path, detail }))).toStrictEqual([
            { path: ["min", "fluid"], detail: { type: "dimension", property: "fluid" } },
        ]);
    });

    it("refuses a reference, since an extension's values are not resolved", () => {
        const reader = extensionReader<typeof messages>();
        expect(reader.read("number", "{ratio.golden}", ["ratio"])).toBeUndefined();
        const result = reader.result(undefined);
        expect(result.ok ? [] : result.errors.map(({ path }) => path)).toStrictEqual([["ratio"]]);
    });

    it("reports a reason with its facts, and a reason that takes none without them", () => {
        const reader = extensionReader<typeof messages>();
        reader.report(["max"], "missing-property", { name: "max" });
        reader.report(["steps"], "no-steps");
        expect(reader.result(undefined)).toStrictEqual({
            ok: false,
            errors: [
                { path: ["max"], reason: "missing-property", data: { name: "max" } },
                { path: ["steps"], reason: "no-steps" },
            ],
        });
    });

    it("keeps every problem, in the order found, and fails even when given a value", () => {
        const reader = extensionReader<typeof messages>();
        reader.report(["max"], "missing-property", { name: "max" });
        reader.read("number", "two", ["ratio"]);
        const result = reader.result({ ratio: 2 });
        expect(result.ok ? [] : result.errors.map(({ path }) => path)).toStrictEqual([
            ["max"],
            ["ratio"],
        ]);
    });

    it("checks each reason and its facts against the messages", () => {
        const reader = extensionReader<typeof messages>();
        // @ts-expect-error: not a reason in the messages
        reader.report([], "too-big");
        // @ts-expect-error: the message needs `name`
        reader.report([], "missing-property");
        // @ts-expect-error: the message takes no facts
        reader.report([], "no-steps", { name: "steps" });
        expect(reader.result(undefined).ok).toBe(false);
    });

    it("throws when asked for a result with no value and nothing reported", () => {
        expect(() => extensionReader<typeof messages>().result(undefined)).toThrow(TypeError);
    });
});

describe("isJsonObject", () => {
    it.for([
        { value: {}, expected: true },
        { value: { min: 1 }, expected: true },
        { value: [], expected: false },
        { value: null, expected: false },
        { value: "fluid", expected: false },
        { value: undefined, expected: false },
    ])("$value is an object: $expected", ({ value, expected }) => {
        expect(isJsonObject(value)).toBe(expected);
    });
});
