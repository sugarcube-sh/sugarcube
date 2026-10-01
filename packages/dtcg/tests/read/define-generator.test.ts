import { describe, expectTypeOf, it } from "vitest";
import {
    type ExtensionValidator,
    type Generator,
    type StandardSchemaV1,
    defineExtensionValidator,
    defineGenerator,
} from "../../src/index.js";

const ratioSchema: StandardSchemaV1<unknown, { ratio: number }> = {
    "~standard": { version: 1, vendor: "test", validate: () => ({ value: { ratio: 1 } }) },
};

const messages = {
    "ratio-not-above-one": ({ ratio }: { ratio: number }) => `a ratio of ${ratio} is too small`,
    "no-multipliers": () => "`multipliers` must name at least one step",
};

describe("defineGenerator", () => {
    it("accepts each reason in its messages, with the facts that message takes", () => {
        const generator = defineGenerator({
            extension: ["com.example", "scale"],
            messages,
            generate: () => ({
                ok: false,
                errors: [
                    { path: ["ratio"], reason: "ratio-not-above-one", data: { ratio: 1 } },
                    { path: ["multipliers"], reason: "no-multipliers" },
                ],
            }),
        });
        expectTypeOf(generator).toEqualTypeOf<Generator>();
    });

    it("refuses a reason its messages do not have", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            messages,
            // @ts-expect-error
            generate: () => ({ ok: false, errors: [{ path: [], reason: "ratio-too-small" }] }),
        });
    });

    it("refuses facts its message does not take", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            messages,
            generate: () => ({
                ok: false,
                errors: [
                    // @ts-expect-error
                    { path: [], reason: "ratio-not-above-one", data: { ratio: "1" } },
                ],
            }),
        });
    });

    it("refuses a reason when it has no messages", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            // @ts-expect-error
            generate: () => ({ ok: false, errors: [{ path: [], reason: "anything" }] }),
        });
    });

    it("types the extension as its schema's output", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            schema: ratioSchema,
            generate: (_group, extension) => {
                expectTypeOf(extension).toEqualTypeOf<{ ratio: number }>();
                return { ok: true, value: [] };
            },
        });
    });

    it("leaves the extension unknown without a schema", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            generate: (_group, extension) => {
                expectTypeOf(extension).toEqualTypeOf<unknown>();
                return { ok: true, value: [] };
            },
        });
    });
});

describe("defineExtensionValidator", () => {
    it("types the extension as its schema's output, and checks reasons against its messages", () => {
        const validator = defineExtensionValidator({
            key: "com.example",
            appliesTo: ["number"],
            schema: ratioSchema,
            messages,
            validate: (_on, extension) => {
                expectTypeOf(extension).toEqualTypeOf<{ ratio: number }>();
                return extension.ratio > 1
                    ? []
                    : [{ path: ["ratio"], reason: "ratio-not-above-one", data: extension }];
            },
        });
        expectTypeOf(validator).toEqualTypeOf<ExtensionValidator>();
    });

    it("refuses a reason its messages do not have", () => {
        defineExtensionValidator({
            key: "com.example",
            appliesTo: ["number"],
            messages,
            // @ts-expect-error
            validate: () => [{ path: [], reason: "ratio-too-small" }],
        });
    });
});
