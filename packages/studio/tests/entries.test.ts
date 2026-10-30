import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { packagesReachedFrom } from "./reached-packages";

const source = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { exports: Record<string, unknown> };

describe("what studio offers", () => {
    it("is an entry for each place it runs, and nothing else", () => {
        expect(Object.keys(manifest.exports)).toStrictEqual(["./vite", "./node", "./sign-in"]);
    });

    it("under Vite, is the plugin", async () => {
        expect(Object.keys(await import("../src/vite"))).toStrictEqual(["default"]);
    });

    it("for any other host, is serving studio and building it", async () => {
        expect(Object.keys(await import("../src/node")).sort()).toStrictEqual([
            "buildStudio",
            "serveStudio",
        ]);
    });
});

describe("what each entry loads", () => {
    it("for the sign-in function on a company's server, is nothing but its own code", () => {
        expect(packagesReachedFrom(source("sign-in.ts"))).toStrictEqual([]);
    });

    it("for a host without Vite, is never Vite", () => {
        const reached = packagesReachedFrom(source("node.ts"));

        expect(reached).not.toContain("vite");
        expect(reached).not.toContain("@sugarcube-sh/vite");
        expect(reached).not.toContain("@devframes/vite");
    });
});
