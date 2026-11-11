import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";

function marked(json: unknown) {
    const text = JSON.stringify(json, null, 2);
    const [problem] = readFromMemory({ files: { "tokens.json": text } }).diagnostics;
    const span = problem?.span;
    return span && text.slice(span.offset, span.offset + span.length);
}

describe("a problem with a whole token or value", () => {
    it("points at the token's name when it has no type", () => {
        expect(marked({ sm: { $value: 4 } })).toBe('"sm"');
    });

    it("points at $value when the value as a whole is wrong", () => {
        expect(marked({ text: { $type: "typography", $value: { fontFamily: "Inter" } } })).toBe(
            '"$value"',
        );
    });
});
