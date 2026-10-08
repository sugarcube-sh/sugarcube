import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { createWatchSession } from "../src/watch/regenerate.js";
import { CASES, GOLDEN_DIR, type GoldenCase, goldenConfig, withoutBanner } from "./golden-cases.js";

async function generate(goldenCase: GoldenCase, dir: string) {
    const outDir = join(dir, "out");
    const { config } = goldenConfig(goldenCase, dir, outDir);
    const { output } = await createWatchSession(config).primeAndBuild();
    return output.map((file) => ({
        name: relative(outDir, file.path),
        css: withoutBanner(file.css),
    }));
}

describe("golden CSS", () => {
    it.each(CASES.map((goldenCase) => [goldenCase.name, goldenCase] as const))(
        "%s",
        async (_name, goldenCase) => {
            const dir = mkdtempSync(join(tmpdir(), "sugarcube-golden-"));
            try {
                const files = await generate(goldenCase, dir);
                expect(files.length).toBeGreaterThan(0);
                for (const file of files) {
                    await expect(file.css).toMatchFileSnapshot(
                        join(GOLDEN_DIR, goldenCase.name, file.name),
                    );
                }
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
    );
});
