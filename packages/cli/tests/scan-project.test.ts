import { realpathSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { InternalConfig } from "@sugarcube-sh/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findUnreadStylesheets, scanProjectCSS } from "../src/scan-project.js";

function configWith(content?: string[], outputDir = "../css"): InternalConfig {
    return {
        variables: { path: `${outputDir}/tokens.css` },
        utilities: { path: `${outputDir}/utilities.css` },
        ...(content ? { content } : {}),
    } as unknown as InternalConfig;
}

describe("scanProjectCSS", () => {
    let base: string;
    let cwdDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        // realpath, because on macOS tmpdir() is /var/... while chdir reports
        // /private/var/... — and this suite compares absolute paths against cwd.
        base = join(realpathSync(tmpdir()), `sugarcube-scan-project-${Date.now()}`);
        cwdDir = join(base, "assets", "js");
        const outputDir = join(base, "assets", "css");
        const templatesDir = join(base, "lib", "app_web");
        await mkdir(cwdDir, { recursive: true });
        await mkdir(outputDir, { recursive: true });
        await mkdir(templatesDir, { recursive: true });

        await writeFile(join(cwdDir, "local.css"), `.local { color: var(--nope-local); }`);
        await writeFile(
            join(cwdDir, "Widget.vue"),
            `<template><div class="w"/></template>\n<style>.w { color: var(--nope-vue); }</style>`,
        );
        await writeFile(
            join(cwdDir, "legacy.htm"),
            `<div class="l"></div>\n<style>.l { color: var(--nope-htm); }</style>`,
        );

        await writeFile(join(outputDir, "app.css"), `.card { color: var(--nope-app); }`);
        await writeFile(join(outputDir, "tokens.css"), `:root { --color-primary: red; }`);
        await writeFile(join(outputDir, "utilities.css"), `.text-primary { color: red; }`);

        await writeFile(join(templatesDir, "shared.css"), `.s { color: var(--nope-lib); }`);
        await writeFile(
            join(templatesDir, "page.heex"),
            `<div class="p"></div>\n<style>.p { color: var(--nope-heex); }</style>`,
        );

        process.chdir(cwdDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await rm(base, { recursive: true, force: true });
    });

    const scanned = async (content?: string[], paths: string[] = []) => {
        const scan = await scanProjectCSS(configWith(content), paths);
        return scan.files.map((file) => basename(file)).sort();
    };

    const markupOnlyContent = () => [join(base, "lib", "**", "*.heex")];
    const outputDirContent = () => [join(base, "assets", "css", "**", "*.css")];

    describe("when content lists only markup that lint cannot parse", () => {
        it("still scans CSS under the working directory", async () => {
            expect(await scanned(markupOnlyContent())).toContain("local.css");
        });

        it("still reads <style> blocks from markup under the working directory", async () => {
            expect(await scanned(markupOnlyContent())).toContain("Widget.vue");
        });

        it("finds the same files it would have found with no content set", async () => {
            expect(await scanned(markupOnlyContent())).toEqual(await scanned());
        });
    });

    it("scans CSS reached through a content glob above the working directory", async () => {
        expect(await scanned([join(base, "lib", "**", "*.css")])).toContain("shared.css");
    });

    it("adds content to the default pattern rather than replacing it", async () => {
        const files = await scanned([join(base, "lib", "**", "*.css")]);
        expect(files).toContain("shared.css");
        expect(files).toContain("local.css");
    });

    it("counts a file matched by both content and the default pattern once", async () => {
        const overlapping = [join(cwdDir, "**", "*.css")];
        const files = await scanned(overlapping);
        expect(files.filter((file) => file === "local.css")).toHaveLength(1);
    });

    it("never scans its own generated output, even when content points at it", async () => {
        const files = await scanned(outputDirContent());
        expect(files).toContain("app.css");
        expect(files).not.toContain("tokens.css");
        expect(files).not.toContain("utilities.css");
    });

    it("parses <style> blocks in .htm as well as .html", async () => {
        expect(await scanned(markupOnlyContent())).toContain("legacy.htm");
    });

    it("uses explicit paths alone, ignoring content", async () => {
        const paths = [join(cwdDir, "local.css")];
        expect(await scanned(markupOnlyContent(), paths)).toEqual(["local.css"]);
    });

    it("collects var() refs from every discovered file", async () => {
        const scan = await scanProjectCSS(configWith(markupOnlyContent()));
        const names = scan.used.map((ref) => ref.name).sort();
        expect(names).toEqual(["--nope-htm", "--nope-local", "--nope-vue"]);
    });

    // Generated output stays out of the scan even when named directly: lint gets those
    // declarations from getGeneratedVarNames, which runs the real variable pipeline and
    // so stays right when the file on disk is stale.
    it("skips generated output even when it is the only path named", async () => {
        const paths = [join(base, "assets", "css", "tokens.css")];
        const scan = await scanProjectCSS(configWith(), paths);
        expect(scan.files).toEqual([]);
        expect([...scan.declared]).toEqual([]);
    });
});

describe("findUnreadStylesheets", () => {
    let base: string;
    let cwdDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        base = join(realpathSync(tmpdir()), `sugarcube-unread-${Date.now()}`);
        cwdDir = join(base, "assets", "js");
        const outputDir = join(base, "assets", "css");
        await mkdir(cwdDir, { recursive: true });
        await mkdir(outputDir, { recursive: true });

        await writeFile(join(cwdDir, "local.css"), `.local { color: var(--nope-local); }`);
        await writeFile(join(outputDir, "app.css"), `.card { color: var(--color-primary); }`);
        await writeFile(join(outputDir, "layout.css"), `.layout { gap: var(--space-md); }`);
        await writeFile(join(outputDir, "tokens.css"), `:root { --color-primary: red; }`);
        await writeFile(join(outputDir, "utilities.css"), `.text-primary { color: red; }`);

        process.chdir(cwdDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await rm(base, { recursive: true, force: true });
    });

    const scanThenCheck = async (content?: string[], outputDir?: string) => {
        const config = configWith(content, outputDir);
        const scan = await scanProjectCSS(config);
        return findUnreadStylesheets(config, scan.files);
    };

    it("reports stylesheets in the output directory that the scan never read", async () => {
        expect(await scanThenCheck()).toEqual([{ dir: "../css", count: 2 }]);
    });

    it("does not count sugarcube's own generated files", async () => {
        const [entry] = await scanThenCheck();
        expect(entry?.count).toBe(2);
    });

    it("stays quiet once content reaches that directory", async () => {
        const content = [join(base, "assets", "css", "**", "*.css")];
        expect(await scanThenCheck(content)).toEqual([]);
    });

    it("stays quiet when the output directory is inside the working directory", async () => {
        await mkdir(join(cwdDir, "styles"), { recursive: true });
        await writeFile(join(cwdDir, "styles", "extra.css"), `.e { color: red; }`);

        expect(await scanThenCheck(undefined, "./styles")).toEqual([]);
    });

    it("stays quiet when the output directory holds nothing but generated CSS", async () => {
        await rm(join(base, "assets", "css", "app.css"));
        await rm(join(base, "assets", "css", "layout.css"));

        expect(await scanThenCheck()).toEqual([]);
    });

    it("reports each output directory separately when they differ", async () => {
        const config = {
            variables: { path: "../css/tokens.css" },
            utilities: { path: "../generated/utilities.css" },
        } as unknown as InternalConfig;
        await mkdir(join(base, "assets", "generated"), { recursive: true });
        await writeFile(join(base, "assets", "generated", "vendor.css"), `.v { color: red; }`);

        const scan = await scanProjectCSS(config);
        const entries = await findUnreadStylesheets(config, scan.files);

        expect(entries).toEqual([
            { dir: "../css", count: 3 },
            { dir: "../generated", count: 1 },
        ]);
    });
});
