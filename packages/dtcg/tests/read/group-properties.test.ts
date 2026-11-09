import { describe, expect, it } from "vitest";
import type { Group, Token } from "../../src/index.js";
import { oneFile } from "../token-files.js";

describe("what applies to a group, and what it writes itself", () => {
    it("is never false, since false only undoes a group's deprecation (Format 5.2.4)", () => {
        // @ts-expect-error a token or group is deprecated or it isn't: false is only ever written
        const written: Token["deprecated"] = false;
        // @ts-expect-error
        const ofGroup: Group["deprecated"] = false;
        expect([written, ofGroup]).toStrictEqual([false, false]);
    });
});

describe("where a group's extensions are written", () => {
    it("is one of the group's own places", () => {
        const space = oneFile({
            space: { $type: "number", $extensions: { "com.example": true }, gap: { $value: 1 } },
        })
            .getPermutation()
            .getGroup("space");
        expect(space?.definitions).toContain(space?.extensionDefinitions["com.example"]);
    });
});
