import { createReadOptions } from "@sugarcube-sh/core/client";
import { readFromMemory } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { afterEach, describe, expect, it } from "vitest";
import { toStudioMessage } from "../../src/server/message";
import { configProblem, getSugarcubeSettings } from "../controllers/demo-message";
import { copyDemo } from "./copy-demo";

let remove = () => {};
afterEach(() => remove());

async function demo() {
    const copy = copyDemo();
    remove = copy.remove;
    const tokens = await read(copy.config.resolver, createReadOptions(copy.config));
    return { ...copy, tokens };
}

describe("toStudioMessage", () => {
    it("sends every file the tokens were read from, by the names they read them by", async () => {
        const { config, tokens } = await demo();

        const message = toStudioMessage({ config, tokens, configProblems: [] });

        expect(Object.keys(message.files).sort()).toEqual([...tokens.files].sort());
        expect(message.files["dark.json"]).toBe(tokens.getText("dark.json"));
        expect(message.entryFile).toBe("tokens.resolver.json");
    });

    it("sends what a browser needs to read the same tokens", async () => {
        const { config, tokens } = await demo();

        const message = toStudioMessage({ config, tokens, configProblems: [] });
        const there = readFromMemory(message, createReadOptions(getSugarcubeSettings(message)));

        expect(there.getTokenPaths()).toEqual(tokens.getTokenPaths());
    });

    it("sends sugarcube's adapter, with the config as its settings", async () => {
        const { config, tokens } = await demo();

        const { adapter } = toStudioMessage({ config, tokens, configProblems: [] });

        expect(adapter.name).toBe("sugarcube");
        expect(adapter.settings).toEqual(JSON.parse(JSON.stringify(config)));
    });

    it("sends the config as plain data, leaving out a naming function", async () => {
        const { config, tokens } = await demo();
        const named = {
            ...config,
            variables: { ...config.variables, variableName: (path: string) => path },
        };

        const message = toStudioMessage({ config: named, tokens, configProblems: [] });

        expect(getSugarcubeSettings(message).variables.variableName).toBeUndefined();
        expect(JSON.parse(JSON.stringify(message))).toEqual(message);
    });

    it("sends the config's problems it is given, with the adapter", async () => {
        const { config, tokens } = await demo();

        expect(
            toStudioMessage({ config, tokens, configProblems: [configProblem] }).adapter.problems,
        ).toEqual([configProblem]);
    });
});
