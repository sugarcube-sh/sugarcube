import { describe, expect, it } from "vitest";
import { getDiagnosticsAt, getJsonAt, getJsonPath, getSpan } from "../src/editor.js";
import { readFromMemory } from "../src/index.js";

const text = JSON.stringify({ gap: { $type: "number", $value: "{nope}" } }, null, 2);
const tokens = readFromMemory({ files: { "tokens.json": text } });
const gap = tokens.getPermutation().getToken("gap");

describe("the questions about positions in the text", () => {
    it("are asked of the read, in the editor entry", () => {
        const place = gap?.winningDefinition;
        const span = place && getSpan(tokens, place);
        expect(span?.file).toBe("tokens.json");
        expect(place && getJsonPath(tokens, place)).toStrictEqual(["gap"]);
        expect(getJsonAt(tokens, "tokens.json", ["gap", "$value"])).toBe("{nope}");
        expect(span && getDiagnosticsAt(tokens, span).map(({ kind }) => kind)).toStrictEqual([
            "missing-reference",
        ]);
    });

    it("are not on the design tokens, which keep to the questions most tools ask", () => {
        for (const gone of ["getSpan", "getJsonPath", "getJsonAt", "getDiagnosticsAt"]) {
            expect(gone in tokens).toBe(false);
        }
    });
});
