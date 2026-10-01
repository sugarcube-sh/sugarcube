import { describe, expect, it } from "vitest";
import {
    type StandardSchemaV1,
    defineExtensionValidator,
    defineGenerator,
    readFromMemory,
} from "../../src/index.js";

const later: StandardSchemaV1 = {
    "~standard": { version: 1, vendor: "test", validate: async (value) => ({ value }) },
};

const text = JSON.stringify({
    space: {
        $type: "dimension",
        $extensions: { "com.example": { steps: 2 } },
        md: { $value: { value: 8, unit: "px" } },
    },
});

describe("an asynchronous schema", () => {
    it("is thrown as a TypeError from a generator, since read checks extensions synchronously", () => {
        const generator = defineGenerator({
            extension: ["com.example", "steps"],
            schema: later,
            generate: () => ({ ok: true, value: [] }),
        });
        expect(() =>
            readFromMemory({ files: { "tokens.json": text } }, { generators: [generator] }),
        ).toThrow(TypeError);
    });

    it("is thrown as a TypeError from an extension validator", () => {
        const validator = defineExtensionValidator({
            key: "com.example",
            appliesTo: ["group"],
            schema: later,
        });
        expect(() =>
            readFromMemory(
                { files: { "tokens.json": text } },
                { extensionValidators: [validator] },
            ),
        ).toThrow(TypeError);
    });
});
