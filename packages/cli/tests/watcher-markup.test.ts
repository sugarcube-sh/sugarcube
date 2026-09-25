import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InternalConfig } from "@sugarcube-sh/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startWatcher } from "../src/watch/watcher.js";

describe("watching token files only", () => {
    let dir: string;

    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), "sugarcube-watch-"));
        writeFileSync(
            join(dir, "color.json"),
            JSON.stringify({ color: { a: { $type: "color", $value: "#000" } } }),
        );
        writeFileSync(
            join(dir, "tokens.resolver.json"),
            JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "./color.json" }] },
                ],
            }),
        );
    });

    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it("watches the token files and nothing for markup", async () => {
        let ready: number | undefined;
        const warnings: string[] = [];
        const watcher = await startWatcher(
            {
                resolver: join(dir, "tokens.resolver.json"),
                content: [join(dir, "**/*.html")],
            } as InternalConfig,
            {
                onRegenerate: async () => {},
                onError: () => {},
                onReady: (count) => {
                    ready = count;
                },
                onWarning: (message) => warnings.push(message),
            },
            { markup: false },
        );

        expect(ready).toBe(2);
        expect(warnings).toEqual([]);
        await watcher.close();
    });
});
