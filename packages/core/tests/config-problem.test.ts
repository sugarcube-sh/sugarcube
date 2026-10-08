import { expect, it } from "vitest";
import { ConfigError, configProblem } from "../src/shared/config-error.js";

it("shows a config that cannot be used as an error about the config, with no place in the tokens", () => {
    const problem = configProblem(new ConfigError("Invalid configuration at root: boom"));
    expect(problem).toStrictEqual({
        kind: "invalid-config",
        severity: "error",
        message: "Invalid configuration at root: boom",
        docs: "https://sugarcube.sh/errors/invalid-config",
        detail: { problem: "Invalid configuration at root: boom" },
    });
});
