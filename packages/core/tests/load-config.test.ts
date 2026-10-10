import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNoConfigError, loadInternalConfig } from "../src/node/config/load.js";
import { ConfigError } from "../src/shared/config-error.js";
import { DEFAULT_CONFIG } from "../src/shared/constants/config.js";
import { ErrorMessages } from "../src/shared/constants/error-messages.js";

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

    it("says a config file that exports nothing does, rather than using the defaults", async () => {
        await writeFile(join(tempDir, "tokens.resolver.json"), "{}");
        await writeFile(join(tempDir, "sugarcube.config.ts"), "");

        const loading = loadInternalConfig();

        await expect(loading).rejects.toMatchObject({
            issues: [{ reason: "exports-nothing", file: "sugarcube.config.ts" }],
        });
        await expect(loading).rejects.toThrow(
            "`sugarcube.config.ts` exports nothing; export your config as `export default { … }`",
        );
    });

    it("takes a config that exports an empty object as one with every default", async () => {
        await writeFile(join(tempDir, "tokens.resolver.json"), "{}");
        await writeFile(join(tempDir, "sugarcube.config.ts"), "export default {};");

        const { configFile } = await loadInternalConfig();

        expect(configFile).toContain("sugarcube.config.ts");
    });

    it("reads the config file again when it changes while being read", async () => {
        await writeFile(join(tempDir, "tokens.resolver.json"), "{}");
        const path = join(tempDir, "sugarcube.config.ts");
        const finished = 'export default { variables: { prefix: "ds" } };';
        await writeFile(
            path,
            `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(path)}, ${JSON.stringify(finished)});\nexport {};\n`,
        );

        const { config } = await loadInternalConfig();

        expect(config.variables.prefix).toBe("ds");
    });

    it("reads the config file again when it changes while a read of it fails", async () => {
        await writeFile(join(tempDir, "tokens.resolver.json"), "{}");
        const path = join(tempDir, "sugarcube.config.ts");
        const finished = 'export default { variables: { prefix: "ds" } };';
        await writeFile(
            join(tempDir, "rewrite.mjs"),
            `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(path)}, ${JSON.stringify(finished)});\nthrow new Error("half written");\n`,
        );
        await writeFile(path, 'import "./rewrite.mjs";\nexport default {};\n');

        const { config } = await loadInternalConfig();

        expect(config.variables.prefix).toBe("ds");
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
        await expect(loading).rejects.toMatchObject({ issues: [{ reason: "no-resolver" }] });
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
        await expect(loading).rejects.toMatchObject({
            issues: [
                { reason: "several-resolvers", paths: ["a.resolver.json", "b.resolver.json"] },
            ],
        });
    });
});

describe("isNoConfigError", () => {
    it("is true when no config and no resolver were found", () => {
        expect(isNoConfigError(new ConfigError([{ reason: "no-resolver" }]))).toBe(true);
    });

    it("goes by the reason, not the words", () => {
        const words = ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER();
        const invalid = new ConfigError([{ reason: "invalid", setting: "", message: words }]);

        expect(isNoConfigError(invalid)).toBe(false);
        expect(isNoConfigError(new Error(words))).toBe(false);
    });

    it("is false for several resolvers", () => {
        const several = new ConfigError([
            { reason: "several-resolvers", paths: ["a.resolver.json"] },
        ]);

        expect(isNoConfigError(several)).toBe(false);
    });
});
