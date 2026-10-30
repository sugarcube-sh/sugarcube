import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type StudioBuild, buildFiles } from "../../src/node/build";
import { STUDIO_DEVFRAME_ID, STUDIO_RPC } from "../../src/studio-names";
import { demoResolver, filesAt } from "./demo";

describe("buildStudio", () => {
    let outDir: string;
    let built: StudioBuild;
    const hubDir = () => join(outDir, "__sugarcube");

    beforeAll(async () => {
        outDir = mkdtempSync(join(tmpdir(), "studio-build-"));
        const files = await filesAt(demoResolver, { repository: "acme/site", branch: "main" });
        built = await buildFiles(files, { outDir });
    }, 60_000);

    afterAll(() => {
        rmSync(outDir, { recursive: true, force: true });
    });

    it("says what to serve, where studio opens and what to add to a page, and nothing about how it's built", () => {
        expect(Object.keys(built).sort()).toStrictEqual([
            "embedTag",
            "gitSave",
            "rootDir",
            "studioPath",
            "warnings",
        ]);
    });

    it("names the folder to serve, with studio inside it", () => {
        expect(built.rootDir).toBe(outDir);
        expect(
            existsSync(join(built.rootDir, built.embedTag.match(/src="([^"]+)"/)?.[1] ?? "")),
        ).toBe(true);
        expect(existsSync(join(built.rootDir, built.studioPath, "index.html"))).toBe(true);
    });

    it("writes the hub folder with studio, the dock bootstrap and a static descriptor", () => {
        expect(existsSync(join(hubDir(), "embedded.js"))).toBe(true);
        expect(existsSync(join(hubDir(), "studio", "index.html"))).toBe(true);

        const meta = JSON.parse(readFileSync(join(hubDir(), "__connection.json"), "utf8"));
        expect(meta.backend).toBe("static");
    });

    it("bakes where the tokens live into the handshake, for studio to save to", () => {
        const meta = JSON.parse(
            readFileSync(join(hubDir(), STUDIO_DEVFRAME_ID, "__connection.json"), "utf8"),
        );
        expect(meta.configs[STUDIO_RPC.CONFIG]).toEqual({
            gitSave: {
                host: "github",
                repository: "acme/site",
                branch: "main",
                entry: "packages/studio/demo/tokens.resolver.json",
                signIn: "/api/sugarcube-studio",
            },
        });
    });

    it("hands back what the developer should know, such as no app name for the install link", () => {
        expect(built.warnings).toHaveLength(1);
        expect(built.warnings[0]).toContain("studio.app");
    });

    it("bakes the token files into the dump, so studio boots with no server", () => {
        const dumpDir = join(hubDir(), "__rpc-dump");
        const records = readdirSync(dumpDir)
            .filter((name) => name.includes("record"))
            .map((name) => readFileSync(join(dumpDir, name), "utf8"))
            .join("\n");

        expect(records).toContain("sugarcube:studio:message");
        expect(records).toContain("color.json");
    });

    it("puts the page script in the dock, so an edit reaches a page the built studio is docked on", () => {
        expect(existsSync(join(hubDir(), "studio", "__page-script", "page-script.mjs"))).toBe(true);
    });

    it("tells the caller the tag and the path, relative to the site root", () => {
        expect(built.embedTag).toBe(
            '<script type="module" src="/__sugarcube/embedded.js"></script>',
        );
        expect(built.studioPath).toBe("/__sugarcube/studio/");
    });
});

describe("buildStudio with nothing to build", () => {
    it("refuses, naming the problems, rather than writing an empty studio", async () => {
        const outDir = mkdtempSync(join(tmpdir(), "studio-build-empty-"));
        const files = await filesAt(join(outDir, "missing.resolver.json"));

        await expect(buildFiles(files, { outDir })).rejects.toThrow(
            /^\[sugarcube studio\] Nothing to build[^]*missing\.resolver\.json/,
        );

        rmSync(outDir, { recursive: true, force: true });
    });
});
