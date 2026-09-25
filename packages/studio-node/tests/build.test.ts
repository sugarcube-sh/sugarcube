import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InternalConfig } from "@sugarcube-sh/core";
import { createNodeTokenSource } from "@sugarcube-sh/studio/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type StudioBuild, buildStudio } from "../src/build";

const demoResolver = fileURLToPath(
    new URL("../../studio/demo/tokens.resolver.json", import.meta.url),
);

describe("buildStudio", () => {
    let outDir: string;
    let built: StudioBuild;

    beforeAll(async () => {
        outDir = mkdtempSync(join(tmpdir(), "studio-build-"));
        const source = createNodeTokenSource({
            loadConfig: async () => ({ resolver: demoResolver, variables: {} }) as InternalConfig,
        });
        built = await buildStudio({ source, outDir, saveUrl: "https://example.test/submit-pr" });
    }, 60_000);

    afterAll(() => {
        rmSync(outDir, { recursive: true, force: true });
    });

    it("names the folder to serve, and puts the hub inside it", () => {
        expect(built.rootDir).toBe(outDir);
        expect(built.hubDir).toBe(join(outDir, "__devframes"));
        expect(
            existsSync(join(built.rootDir, built.embedTag.match(/src="([^"]+)"/)?.[1] ?? "")),
        ).toBe(true);
        expect(existsSync(join(built.rootDir, built.studioPath, "index.html"))).toBe(true);
    });

    it("writes the hub folder with Studio, the dock bootstrap and a static descriptor", () => {
        expect(existsSync(join(built.hubDir, "embedded.js"))).toBe(true);
        expect(existsSync(join(built.hubDir, "sugarcube-studio", "index.html"))).toBe(true);

        const meta = JSON.parse(readFileSync(join(built.hubDir, "__connection.json"), "utf8"));
        expect(meta.backend).toBe("static");
    });

    it("bakes the save address into the handshake", () => {
        const meta = JSON.parse(
            readFileSync(join(built.hubDir, "sugarcube-studio", "__connection.json"), "utf8"),
        );
        expect(meta.configs["sugarcube:studio"]).toEqual({
            saveUrl: "https://example.test/submit-pr",
        });
    });

    it("bakes the token files into the dump, so Studio boots with no server", () => {
        const dumpDir = join(built.hubDir, "__rpc-dump");
        const records = readdirSync(dumpDir)
            .filter((name) => name.includes("record"))
            .map((name) => readFileSync(join(dumpDir, name), "utf8"))
            .join("\n");

        expect(records).toContain("sugarcube:studio:disk");
        expect(records).toContain("color.json");
    });

    it("puts the page script in the dock, so an edit reaches a page the built Studio is docked on", () => {
        expect(
            existsSync(join(built.hubDir, "sugarcube-studio", "__page-script", "page-script.mjs")),
        ).toBe(true);
    });

    it("reports nothing wrong with the demo", () => {
        expect(built.errors).toEqual([]);
    });

    it("tells the caller the tag and the path, relative to the site root", () => {
        expect(built.embedTag).toBe(
            '<script type="module" src="/__devframes/embedded.js"></script>',
        );
        expect(built.studioPath).toBe("/__devframes/sugarcube-studio/");
    });
});

describe("buildStudio with nothing to build", () => {
    it("refuses, naming the reason, rather than writing an empty Studio", async () => {
        const outDir = mkdtempSync(join(tmpdir(), "studio-build-empty-"));
        const source = createNodeTokenSource({
            loadConfig: async () => {
                throw new Error("Unexpected token in sugarcube.config.ts");
            },
        });

        await expect(buildStudio({ source, outDir })).rejects.toThrow(
            "Unexpected token in sugarcube.config.ts",
        );

        rmSync(outDir, { recursive: true, force: true });
    });
});
