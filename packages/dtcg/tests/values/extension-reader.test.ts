import { describe, expect, it } from "vitest";
import { defineExtensionValidator } from "../../src/index.js";
import { createExtensionReader, isJsonObject } from "../../src/values.js";
import { oneFile } from "../token-files.js";

const messages = {
    "missing-property": ({ name }: { name: string }) => `the range needs \`${name}\``,
    "no-steps": () => "the scale needs at least one step",
};

describe("createExtensionReader", () => {
    it("reads a literal value", () => {
        const reader = createExtensionReader<typeof messages>();
        expect(reader.read("dimension", { value: 1, unit: "rem" }, ["min"])).toStrictEqual({
            value: 1,
            unit: "rem",
        });
        expect(reader.result("done")).toStrictEqual({ ok: true, value: "done" });
    });

    it("gives nothing for a value that does not fit, and keeps the parser's error", () => {
        const reader = createExtensionReader<typeof messages>();
        expect(reader.read("dimension", "16px", ["min"])).toBeUndefined();
        const result = reader.result(undefined);
        expect(
            result.ok ? [] : result.errors.map((each) => ("detail" in each ? each.detail : each)),
        ).toEqual([
            {
                type: "dimension",
                reason: "string-with-unit",
                value: "16px",
                asObject: { value: 16, unit: "px" },
            },
        ]);
    });

    it("refuses a property a value's type does not define, as a token's value would be", () => {
        const reader = createExtensionReader<typeof messages>();
        expect(
            reader.read("dimension", { value: 1, unit: "rem", fluid: true }, ["min"]),
        ).toBeUndefined();
        const result = reader.result(undefined);
        expect(
            result.ok ? [] : result.errors.map((each) => ("detail" in each ? each.detail : each)),
        ).toEqual([{ type: "dimension", reason: "unknown-property", property: "fluid" }]);
    });

    it("with ignoreUnknownProperties, keeps what a value sets aside, beside the result", () => {
        const reader = createExtensionReader<typeof messages>({ ignoreUnknownProperties: true });
        expect(
            reader.read("dimension", { value: 1, unit: "rem", fluid: true }, ["min"]),
        ).toStrictEqual({
            value: 1,
            unit: "rem",
        });
        const result = reader.result("done");
        expect(result.ok).toBe(true);
        expect(result.ignored?.map(({ jsonPath, detail }) => ({ jsonPath, detail }))).toStrictEqual(
            [{ jsonPath: ["min", "fluid"], detail: { type: "dimension", property: "fluid" } }],
        );
    });

    it("refuses a reference, since an extension's values are not resolved", () => {
        const reader = createExtensionReader<typeof messages>();
        expect(reader.read("number", "{ratio.golden}", ["ratio"])).toBeUndefined();
        const result = reader.result(undefined);
        expect(result.ok ? [] : result.errors.map(({ jsonPath }) => jsonPath)).toStrictEqual([
            ["ratio"],
        ]);
    });

    it("reports a reason with its facts, and a reason that takes none without them", () => {
        const reader = createExtensionReader<typeof messages>();
        reader.report(["max"], "missing-property", { name: "max" });
        reader.report(["steps"], "no-steps");
        expect(reader.result(undefined)).toStrictEqual({
            ok: false,
            errors: [
                { jsonPath: ["max"], reason: "missing-property", data: { name: "max" } },
                { jsonPath: ["steps"], reason: "no-steps" },
            ],
        });
    });

    it("keeps every problem, in the order found, and fails even when given a value", () => {
        const reader = createExtensionReader<typeof messages>();
        reader.report(["max"], "missing-property", { name: "max" });
        reader.read("number", "two", ["ratio"]);
        const result = reader.result({ ratio: 2 });
        expect(result.ok ? [] : result.errors.map(({ jsonPath }) => jsonPath)).toStrictEqual([
            ["max"],
            ["ratio"],
        ]);
    });

    it("checks each reason and its facts against the messages", () => {
        const reader = createExtensionReader<typeof messages>();
        // @ts-expect-error: not a reason in the messages
        reader.report([], "too-big");
        // @ts-expect-error: the message needs `name`
        reader.report([], "missing-property");
        // @ts-expect-error: the message takes no facts
        reader.report([], "no-steps", { name: "steps" });
        expect(reader.result(undefined).ok).toBe(false);
    });

    it("throws when asked for a result with no value and nothing reported", () => {
        expect(() => createExtensionReader<typeof messages>().result(undefined)).toThrow(TypeError);
    });
});

describe("a reader's result returned from validate", () => {
    it("reports its errors, and the properties it set aside", () => {
        const range = defineExtensionValidator({
            key: "com.example",
            appliesTo: ["dimension"],
            messages,
            validate: (_token, extension, options) => {
                const reader = createExtensionReader<typeof messages>(options);
                const { min, max } = extension as { min?: unknown; max?: unknown };
                reader.read("dimension", min, ["min"]);
                if (max === undefined) reader.report(["max"], "missing-property", { name: "max" });
                return reader.result(extension);
            },
        });
        const tokens = oneFile(
            {
                gap: {
                    $type: "dimension",
                    $value: { value: 1, unit: "rem" },
                    $extensions: { "com.example": { min: { value: 1, unit: "rem", fluid: true } } },
                },
            },
            { extensionValidators: [range], ignoreUnknownProperties: true },
        );
        expect(tokens.diagnostics.map(({ kind, message }) => [kind, message])).toStrictEqual([
            ["unknown-property", expect.stringContaining("fluid")],
            ["extension-invalid", "the range needs `max`"],
        ]);
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
