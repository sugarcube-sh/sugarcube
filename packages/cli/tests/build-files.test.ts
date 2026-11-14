import { describe, expect, it } from "vitest";
import { buildFromMemory } from "../src/build.js";

const token = (name: string) => JSON.stringify({ [name]: { $type: "number", $value: 1 } });

describe("buildFromMemory", () => {
    it("reads from the entry it is given, the one its problems are placed by", async () => {
        const built = await buildFromMemory(
            { "a.json": token("a"), "b.json": token("b") },
            "b.json",
        );

        expect(built.tokens.getTokenPaths()).toEqual(["b"]);
        expect(built.entryFile).toBe("b.json");
    });
});
