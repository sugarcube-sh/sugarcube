import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProjectInfo, hasSrcDir } from "../src/detection/framework.js";

const testDir = join(process.cwd(), "test-fixtures");

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

describe("Project Detection", () => {
    beforeEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe("hasSrcDir", () => {
        it("returns true when src/ directory exists", () => {
            createTestProject({
                src: { "main.ts": "" },
            });

            expect(hasSrcDir(testDir)).toBe(true);
        });

        it("returns false when src/ directory does not exist", () => {
            createTestProject({
                "index.html": "<html></html>",
            });

            expect(hasSrcDir(testDir)).toBe(false);
        });
    });

    describe("getProjectInfo", () => {
        it("returns src-prefixed paths when src/ exists", () => {
            createTestProject({
                src: { "main.ts": "" },
                "package.json": JSON.stringify({ dependencies: {} }),
            });

            const result = getProjectInfo(testDir);

            expect(result.isSrcDir).toBe(true);
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
            expect(result.componentDir).toBe("src/components/ui");
        });

        it("returns root-level paths when src/ does not exist", () => {
            createTestProject({
                "index.html": "<html></html>",
                "package.json": JSON.stringify({ dependencies: {} }),
            });

            const result = getProjectInfo(testDir);

            expect(result.isSrcDir).toBe(false);
            expect(result.tokensDir).toBe("design-tokens");
            expect(result.stylesDir).toBe("styles");
            expect(result.componentDir).toBe("components/ui");
        });
    });
});
