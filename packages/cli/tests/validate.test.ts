import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";
import { loadAndResolveTokensForCLI } from "../src/pipelines/load-and-resolve-for-cli.js";
import { CLIError } from "../src/types/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("token validation", () => {
    const baseConfig = {
        output: DEFAULT_CONFIG.output,
        transforms: DEFAULT_CONFIG.transforms,
    };

    it("validates correct token files using memory loading", async () => {
        const validTokens = readFileSync(
            path.join(__dirname, "fixtures/valid-tokens.json"),
            "utf-8"
        );

        const memoryData = {
            "valid-tokens.json": {
                collection: "default",
                content: validTokens,
            },
        };

        await expect(loadAndResolveTokensForCLI(baseConfig, memoryData)).resolves.not.toThrow();
    });

    it("fails on invalid token files", async () => {
        const invalidTokens = readFileSync(
            path.join(__dirname, "fixtures/invalid-tokens.json"),
            "utf-8"
        );

        const memoryData = {
            "invalid-tokens.json": {
                collection: "default",
                content: invalidTokens,
            },
        };

        await expect(loadAndResolveTokensForCLI(baseConfig, memoryData)).rejects.toThrow(CLIError);
    });

    it("throws when no resolver configured and no memoryData provided", async () => {
        await expect(loadAndResolveTokensForCLI(baseConfig)).rejects.toThrow(
            "No resolver path configured"
        );
    });
});
