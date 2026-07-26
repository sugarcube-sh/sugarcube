import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMarkupFiles } from "../src/scan-markup.js";

describe("getMarkupFiles with content patterns", () => {
    let base: string;
    let cwdDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        base = join(tmpdir(), `sugarcube-scan-${Date.now()}`);
        cwdDir = join(base, "assets", "js");
        const templatesDir = join(base, "lib", "app_web");
        const vendorDir = join(templatesDir, "vendor");
        await mkdir(cwdDir, { recursive: true });
        await mkdir(vendorDir, { recursive: true });
        await writeFile(join(templatesDir, "page.heex"), `<div class="p-400"></div>`);
        await writeFile(join(templatesDir, "styles.css"), `.x { color: red; }`);
        await writeFile(join(vendorDir, "widget.heex"), `<div class="p-800"></div>`);
        process.chdir(cwdDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await rm(base, { recursive: true, force: true });
    });

    it("scans a content glob that points above the working directory", async () => {
        const pattern = join(base, "lib", "**", "*");

        const files = await getMarkupFiles([pattern]);

        expect(files.some((f) => f.endsWith("page.heex"))).toBe(true);
    });

    it("filters out non-markup files from a broad content glob", async () => {
        const pattern = join(base, "lib", "**", "*");

        const files = await getMarkupFiles([pattern]);

        expect(files.some((f) => f.endsWith("page.heex"))).toBe(true);
        expect(files.some((f) => f.endsWith("styles.css"))).toBe(false);
    });

    it("excludes files matched by a negation glob", async () => {
        const include = join(base, "lib", "**", "*.heex");
        const exclude = `!${join(base, "lib", "**", "vendor", "**")}`;

        const files = await getMarkupFiles([include, exclude]);

        expect(files.some((f) => f.endsWith("page.heex"))).toBe(true);
        expect(files.some((f) => f.endsWith("widget.heex"))).toBe(false);
    });
});
