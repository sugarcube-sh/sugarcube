import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { disagreements } from "./disagreements.js";
import { suiteCases } from "./suite.js";

function errorsIn(file: string, text: string): string[] {
    return readFromMemory({ files: { [file]: text }, entryFile: file })
        .diagnostics.filter((problem) => problem.severity === "error")
        .map((problem) => `${problem.kind}: ${problem.message}`);
}

describe("the DTCG test suite", () => {
    it.each(suiteCases)("$id", ({ id, valid, file, text }) => {
        const errors = errorsIn(file, text);
        const refuses = valid === id in disagreements;
        if (refuses) expect(errors, "no error").not.toStrictEqual([]);
        else expect(errors).toStrictEqual([]);
    });

    it("lists only disagreements with cases the suite has", () => {
        const ids = new Set(suiteCases.map((each) => each.id));
        expect(Object.keys(disagreements).filter((id) => !ids.has(id))).toStrictEqual([]);
    });
});
