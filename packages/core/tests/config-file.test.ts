import { describe, expect, it } from "vitest";
import { isConfigFile } from "../src/node/config/load.js";

describe("isConfigFile", () => {
    const root = "C:/project";

    it("is the config file whichever way its slashes are written", () => {
        expect(isConfigFile("C:\\project\\sugarcube.config.ts", root)).toBe(true);
        expect(isConfigFile("C:/project/sugarcube.config.ts", root)).toBe(true);
    });

    it("is a config file with either extension sugarcube reads", () => {
        expect(isConfigFile("C:/project/sugarcube.config.js", root)).toBe(true);
        expect(isConfigFile("C:/project/sugarcube.config.mjs", root)).toBe(false);
    });

    it("is not a config file in another folder, nor any other file", () => {
        expect(isConfigFile("C:/project/site/sugarcube.config.ts", root)).toBe(false);
        expect(isConfigFile("C:\\project\\tokens\\base.json", root)).toBe(false);
    });
});
