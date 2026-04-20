import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInternalConfig, loadSugarcubeConfig } from "../src/node/config/load.js";
import { DEFAULT_CONFIG } from "../src/shared/constants/config.js";

describe("loadInternalConfig", () => {
    let tempDir: string;
    const originalCwd = process.cwd();

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "sugarcube-test-"));
        vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        process.chdir(originalCwd);
        await rm(tempDir, { recursive: true, force: true });
    });

    it("loads config file, validates, fills defaults, and returns complete config", async () => {
        const configContent = `
            export default {
                resolver: "./tokens.resolver.json",
                variables: {
                    path: "styles/tokens.css"
                }
            };
        `;
        await writeFile(join(tempDir, "sugarcube.config.js"), configContent);

        const result = await loadInternalConfig();

        expect(result.config.resolver).toBe("./tokens.resolver.json");
        expect(result.config.variables.path).toBe("styles/tokens.css");
        expect(result.config.utilities.path).toContain(DEFAULT_CONFIG.utilities.filename);
        expect(result.config.variables.transforms.fluid.min).toBe(
            DEFAULT_CONFIG.variables.transforms.fluid.min
        );
        expect(result.config.variables.transforms.fluid.max).toBe(
            DEFAULT_CONFIG.variables.transforms.fluid.max
        );
        expect(result.configPath).toContain("sugarcube.config.js");
    });

    it("auto-discovers resolver when no config file exists", async () => {
        await writeFile(
            join(tempDir, "tokens.resolver.json"),
            JSON.stringify({ version: "2025.10", resolutionOrder: [] })
        );

        const result = await loadInternalConfig();

        expect(result.config.resolver).toContain("tokens.resolver.json");
        expect(result.config.variables.path).toContain(DEFAULT_CONFIG.variables.filename);
        expect(result.configPath).toContain("tokens.resolver.json");
    });
});

describe("loadSugarcubeConfig", () => {
    let tempDir: string;
    const originalCwd = process.cwd();

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "sugarcube-test-"));
        vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        process.chdir(originalCwd);
        await rm(tempDir, { recursive: true, force: true });
    });

    it("loads user config without filling defaults", async () => {
        const configContent = `
            export default {
                resolver: "./tokens.resolver.json",
                variables: { path: "styles/tokens.css" }
            };
        `;
        await writeFile(join(tempDir, "sugarcube.config.js"), configContent);

        const result = await loadSugarcubeConfig();

        expect(result.config.resolver).toBe("./tokens.resolver.json");
        expect(result.config.variables?.path).toBe("styles/tokens.css");
        // transforms should be undefined - not filled in yet
        expect(result.config.variables?.transforms).toBeUndefined();
    });
});
