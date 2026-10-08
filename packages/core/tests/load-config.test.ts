import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInternalConfig } from "../src/node/config/load.js";
import { ConfigError } from "../src/shared/config-error.js";
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
            DEFAULT_CONFIG.variables.transforms.fluid.min,
        );
        expect(result.config.variables.transforms.fluid.max).toBe(
            DEFAULT_CONFIG.variables.transforms.fluid.max,
        );
        expect(result.configFile).toContain("sugarcube.config.js");
    });

    it("makes content globs absolute, keeping a leading ! (negation)", async () => {
        const configContent = `
            export default {
                resolver: "./tokens.resolver.json",
                content: ["./lib/**/*.heex", "!./lib/**/vendor/**"],
            };
        `;
        await writeFile(join(tempDir, "sugarcube.config.js"), configContent);

        const result = await loadInternalConfig();

        expect(result.config.content).toEqual([
            join(tempDir, "lib", "**", "*.heex"),
            `!${join(tempDir, "lib", "**", "vendor", "**")}`,
        ]);
    });

    it("puts the settings it is given over the config's, after its defaults", async () => {
        const configContent = `
            export default {
                resolver: "./tokens.resolver.json",
                variables: { permutations: [{ input: {}, selector: ":root" }] },
            };
        `;
        await writeFile(join(tempDir, "sugarcube.config.js"), configContent);

        const result = await loadInternalConfig({
            variables: {
                prefix: "ds",
                transforms: { fluid: { min: 360 } },
                permutations: [{ input: { theme: "dark" }, selector: ":root" }],
            },
            utilities: { path: undefined },
        });

        expect(result.config.variables.prefix).toBe("ds");
        expect(result.config.variables.transforms.fluid).toEqual({
            min: 360,
            max: DEFAULT_CONFIG.variables.transforms.fluid.max,
        });
        expect(result.config.variables.permutations).toEqual([
            { input: { theme: "dark" }, selector: ":root" },
        ]);
        expect(result.config.utilities.path).toContain(DEFAULT_CONFIG.utilities.filename);
    });

    it("checks the settings it is given as it checks the config", async () => {
        await writeFile(
            join(tempDir, "tokens.resolver.json"),
            JSON.stringify({ version: "2025.10", resolutionOrder: [] }),
        );

        const loading = loadInternalConfig({
            variables: { transforms: { fluid: { min: Number.NaN } } },
        });

        await expect(loading).rejects.toBeInstanceOf(ConfigError);
        await expect(loading).rejects.toThrow("variables.transforms.fluid.min");
    });

    it("auto-discovers resolver when no config file exists", async () => {
        await writeFile(
            join(tempDir, "tokens.resolver.json"),
            JSON.stringify({ version: "2025.10", resolutionOrder: [] }),
        );

        const result = await loadInternalConfig();

        expect(result.config.resolver).toContain("tokens.resolver.json");
        expect(result.config.variables.path).toContain(DEFAULT_CONFIG.variables.filename);
        expect(result.configFile).toBeUndefined();
    });

    it("finds the resolver for a config file that names none", async () => {
        await writeFile(join(tempDir, "sugarcube.config.js"), "export default {};");
        await writeFile(
            join(tempDir, "tokens.resolver.json"),
            JSON.stringify({ version: "2025.10", resolutionOrder: [] }),
        );

        const result = await loadInternalConfig();

        expect(result.config.resolver).toContain("tokens.resolver.json");
        expect(result.configFile).toContain("sugarcube.config.js");
    });

    it("reads the resolver it is given, rather than looking for one", async () => {
        const resolver = JSON.stringify({ version: "2025.10", resolutionOrder: [] });
        await writeFile(join(tempDir, "a.resolver.json"), resolver);
        await writeFile(join(tempDir, "b.resolver.json"), resolver);

        const loose = await loadInternalConfig({ resolver: "b.resolver.json" });
        expect(loose.config.resolver).toBe("b.resolver.json");

        await writeFile(join(tempDir, "sugarcube.config.js"), "export default {};");
        const withFile = await loadInternalConfig({ resolver: "b.resolver.json" });
        expect(withFile.config.resolver).toBe("b.resolver.json");
        expect(withFile.configFile).toContain("sugarcube.config.js");
    });

    it("reports a mistake in the config file as a ConfigError", async () => {
        await writeFile(
            join(tempDir, "sugarcube.config.js"),
            'export default { resolver: "./tokens.resolver.json", variables: { prefix: 5 } };',
        );

        const loading = loadInternalConfig();

        await expect(loading).rejects.toBeInstanceOf(ConfigError);
        await expect(loading).rejects.toThrow("variables.prefix");
    });

    it("says no tokens were found when there is no config and no resolver", async () => {
        const loading = loadInternalConfig();

        await expect(loading).rejects.toBeInstanceOf(ConfigError);
        await expect(loading).rejects.toThrow(
            "No design tokens found.\n\nRun @sugarcube-sh/cli init to set up your design tokens.\n\nStuck? https://sugarcube.sh/docs",
        );
    });

    it("names every resolver it found when nothing says which to use", async () => {
        const resolver = JSON.stringify({ version: "2025.10", resolutionOrder: [] });
        await writeFile(join(tempDir, "a.resolver.json"), resolver);
        await writeFile(join(tempDir, "b.resolver.json"), resolver);

        const loading = loadInternalConfig();

        await expect(loading).rejects.toBeInstanceOf(ConfigError);
        await expect(loading).rejects.toThrow(
            "Several resolver files were found:\n  - a.resolver.json\n  - b.resolver.json\n\nName the one to use as `resolver` in sugarcube.config.ts.",
        );
    });
});
