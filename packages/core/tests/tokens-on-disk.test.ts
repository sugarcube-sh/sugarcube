import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { tokensOnDisk } from "../src/node/tokens-on-disk.js";
import { readOptions } from "../src/shared/read-options.js";

function loaded(variables?: Parameters<typeof fillDefaults>[0]["variables"]) {
    const resolver = "tokens/tokens.resolver.json";
    return { ...fillDefaults({ resolver, ...(variables ? { variables } : {}) }), resolver };
}

describe("tokensOnDisk", () => {
    it("reads the config's resolver", () => {
        expect(tokensOnDisk(loaded()).entryFile).toBe("tokens/tokens.resolver.json");
    });

    it("reads it as sugarcube reads tokens, for the permutations the config lists", () => {
        const config = loaded({ permutations: [{ input: { theme: "dark" }, selector: ".dark" }] });

        expect(tokensOnDisk(config).options).toEqual(readOptions(config));
        expect(tokensOnDisk(config).options?.inputs).toEqual([{ theme: "dark" }]);
    });
});
