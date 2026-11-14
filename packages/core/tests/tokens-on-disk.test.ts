import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { getTokensOnDisk } from "../src/node/tokens-on-disk.js";
import { createReadOptions } from "../src/shared/read-options.js";

function loaded(variables?: Parameters<typeof fillDefaults>[0]["variables"]) {
    const resolver = "tokens/tokens.resolver.json";
    return { ...fillDefaults({ resolver, ...(variables ? { variables } : {}) }), resolver };
}

describe("getTokensOnDisk", () => {
    it("reads the config's resolver", () => {
        expect(getTokensOnDisk(loaded()).entryFile).toBe("tokens/tokens.resolver.json");
    });

    it("reads it as sugarcube reads tokens, for the permutations the config lists", () => {
        const config = loaded({ permutations: [{ input: { theme: "dark" }, selector: ".dark" }] });

        expect(getTokensOnDisk(config).options).toEqual(createReadOptions(config));
        expect(getTokensOnDisk(config).options?.inputs).toEqual([{ theme: "dark" }]);
    });
});
