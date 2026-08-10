import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InternalConfig, NormalizedRenderableTokens } from "@sugarcube-sh/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanUtilityUsage } from "../src/analyze/scan-utilities.js";

const tokens: NormalizedRenderableTokens = {
    default: {
        "space-md": {
            $type: "dimension",
            $value: { value: 1, unit: "rem" },
            $path: "space.md",
            $originalPath: "space.md",
            $source: { sourcePath: "space.json" },
            $names: { css: "space-md" },
        },
    },
};

function configWith(content?: string[]): InternalConfig {
    return {
        utilities: { classes: { padding: { source: "space.*", prefix: "p" } } },
        ...(content ? { content } : {}),
    } as unknown as InternalConfig;
}

describe("scanUtilityUsage", () => {
    let base: string;
    let cwdDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        base = join(tmpdir(), `sugarcube-utilities-${Date.now()}`);
        cwdDir = join(base, "assets", "js");
        const templatesDir = join(base, "lib", "app_web");
        await mkdir(cwdDir, { recursive: true });
        await mkdir(templatesDir, { recursive: true });
        await writeFile(join(templatesDir, "page.heex"), `<div class="p-md"></div>`);
        process.chdir(cwdDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await rm(base, { recursive: true, force: true });
    });

    it("finds utility usage in markup above the working directory via `content`", async () => {
        const usage = await scanUtilityUsage(configWith([join(base, "lib", "**", "*")]), tokens);

        expect(usage.fileCount).toBe(1);
        expect(usage.refs.map((ref) => ref.name)).toContain("--space-md");
    });

    it("finds nothing without `content`, because the templates are outside the cwd", async () => {
        const usage = await scanUtilityUsage(configWith(), tokens);

        expect(usage.fileCount).toBe(0);
        expect(usage.refs).toEqual([]);
    });

    it("scans template extensions beyond the JS/JSX set", async () => {
        const usage = await scanUtilityUsage(
            configWith([join(base, "lib", "**", "*.heex")]),
            tokens,
        );

        expect(usage.refs.map((ref) => ref.name)).toContain("--space-md");
    });

    it("lets explicit paths override `content`", async () => {
        const otherDir = join(base, "other");
        await mkdir(otherDir, { recursive: true });
        await writeFile(join(otherDir, "widget.heex"), `<div class="p-md"></div>`);

        const usage = await scanUtilityUsage(configWith([join(base, "lib", "**", "*")]), tokens, [
            join(otherDir, "**", "*"),
        ]);

        expect(usage.fileCount).toBe(1);
        expect(usage.refs.map((ref) => ref.name)).toContain("--space-md");
    });
});
