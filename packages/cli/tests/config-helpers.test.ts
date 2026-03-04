import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getComponentsDir, getCubeDir } from "../src/utils/config-helpers.js";

const testDir = join(process.cwd(), "test-fixtures-config-helpers");

function createTestProject(structure: Record<string, string | object>) {
    function createStructure(obj: Record<string, string | object>, basePath: string) {
        for (const [key, value] of Object.entries(obj)) {
            const fullPath = join(basePath, key);

            if (typeof value === "string") {
                writeFileSync(fullPath, value);
            } else {
                mkdirSync(fullPath, { recursive: true });
                if (value && typeof value === "object") {
                    createStructure(value as Record<string, string | object>, fullPath);
                }
            }
        }
    }

    mkdirSync(testDir, { recursive: true });
    createStructure(structure, testDir);
}

describe("Config Helpers", () => {
    const originalCwd = process.cwd();

    beforeEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        process.chdir(originalCwd);
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe("getCubeDir", () => {
        it("returns flag value when provided", async () => {
            createTestProject({
                "package.json": JSON.stringify({ name: "test" }),
            });
            process.chdir(testDir);

            const result = await getCubeDir("custom/cube");

            expect(result.directory).toContain("custom/cube");
        });

        it("returns src/styles when src/ exists and no config", async () => {
            createTestProject({
                "package.json": JSON.stringify({ name: "test" }),
                src: { "main.ts": "" },
            });
            process.chdir(testDir);

            const result = await getCubeDir(undefined);

            expect(result.directory).toContain("src/styles");
        });

        it("returns styles when src/ does not exist and no config", async () => {
            createTestProject({
                "package.json": JSON.stringify({ name: "test" }),
            });
            process.chdir(testDir);

            const result = await getCubeDir(undefined);

            expect(result.directory).toContain("styles");
            expect(result.directory).not.toContain("src/styles");
        });
    });

    describe("getComponentsDir", () => {
        it("returns flag value when provided", async () => {
            createTestProject({
                "package.json": JSON.stringify({ name: "test" }),
            });
            process.chdir(testDir);

            const result = await getComponentsDir("custom/components");

            expect(result.directory).toContain("custom/components");
        });

        it("returns src/components/ui when src/ exists and no config", async () => {
            createTestProject({
                "package.json": JSON.stringify({ name: "test" }),
                src: { "main.ts": "" },
            });
            process.chdir(testDir);

            const result = await getComponentsDir(undefined);

            expect(result.directory).toContain("src/components/ui");
        });

        it("returns components/ui when src/ does not exist and no config", async () => {
            createTestProject({
                "package.json": JSON.stringify({ name: "test" }),
            });
            process.chdir(testDir);

            const result = await getComponentsDir(undefined);

            expect(result.directory).toContain("components/ui");
            expect(result.directory).not.toContain("src/components/ui");
        });
    });
});
