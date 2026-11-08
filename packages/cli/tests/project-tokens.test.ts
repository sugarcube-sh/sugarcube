import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectExistingTokens } from "../src/project/tokens.js";

let folder: string;

beforeEach(async () => {
    folder = await realpath(await mkdtemp(join(tmpdir(), "sugarcube-init-tokens-")));
});

afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
});

async function files(written: Record<string, unknown>): Promise<void> {
    for (const [path, content] of Object.entries(written)) {
        await mkdir(dirname(join(folder, path)), { recursive: true });
        await writeFile(join(folder, path), JSON.stringify(content));
    }
}

describe("detectExistingTokens", () => {
    it("finds tokens written only as a recipe, with no $value", async () => {
        await files({
            "space.json": {
                space: { $type: "dimension", $extensions: { "sh.sugarcube": { scale: {} } } },
            },
        });
        expect(await detectExistingTokens(folder)).toBe(true);
    });

    it("doesn't count token files inside node_modules", async () => {
        await files({ "node_modules/kit/tokens.json": { ink: { $value: "#000000" } } });
        expect(await detectExistingTokens(folder)).toBe(false);
    });

    it("finds none in a folder that doesn't exist", async () => {
        expect(await detectExistingTokens(join(folder, "missing"))).toBe(false);
    });
});
