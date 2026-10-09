import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Document, token } from "@sugarcube-sh/dtcg";
import { type Logger, type ViteDevServer, createServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import dtcg, { type DtcgPlugin } from "../src/index.js";

const color = (hex: string) => ({ $type: "color", $value: hex });

let folder: string;
let server: ViteDevServer | undefined;

afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
});

async function project(): Promise<string> {
    folder = await mkdtemp(join(tmpdir(), "dtcg-vite-"));
    await mkdir(join(folder, "tokens"));
    await tokens({ color: { ink: color("#111111") } });
    await writeFile(
        join(folder, "tokens/tokens.resolver.json"),
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
        }),
    );
    return join(folder, "tokens/tokens.resolver.json");
}

function tokens(json: unknown) {
    return writeFile(join(folder, "tokens/base.json"), JSON.stringify(json));
}

function capturing(logged: string[]): Logger {
    const log = (message: string) => {
        logged.push(message);
    };
    return {
        info: log,
        warn: log,
        warnOnce: log,
        error: log,
        clearScreen: () => {},
        hasErrorLogged: () => false,
        hasWarned: false,
    };
}

async function serve(plugin: DtcgPlugin, logged: string[] = []): Promise<ViteDevServer> {
    let watching: Promise<void> = Promise.resolve();
    const ready = {
        name: "test:watcher-ready",
        configureServer(dev: ViteDevServer) {
            watching = new Promise((resolve) => dev.watcher.once("ready", () => resolve()));
        },
    };
    server = await createServer({
        root: folder,
        configFile: false,
        customLogger: capturing(logged),
        plugins: [ready, plugin],
        server: { port: 0 },
    });
    await watching;
    return server;
}

async function until(done: () => boolean, what: string, step?: () => Promise<void>) {
    const started = Date.now();
    while (!done()) {
        if (Date.now() - started > 5_000) throw new Error(`Waited for ${what}`);
        await step?.();
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

describe("dtcg's Vite plugin", () => {
    it("reads again when a file the Document lists is saved on Vite's watcher", async () => {
        const entry = await project();
        const plugin = dtcg({ entry, options: { hexStringColors: true } });
        await serve(plugin);
        expect((await plugin.api.document()).files).toEqual(["tokens.resolver.json", "base.json"]);

        const reads: Array<{ doc: Document; file?: string }> = [];
        plugin.api.onRead((doc, { file }) => reads.push({ doc, file }));
        await until(
            () => reads.some(({ doc }) => JSON.stringify(token(doc, "color.ink")).includes("#222")),
            "the save",
            () => tokens({ color: { ink: color("#222222") } }),
        );

        expect(reads.at(-1)?.file).toBe("base.json");
    });

    it("logs a failure from before Vite's logger exists, once there is one", async () => {
        await project();
        const plugin = dtcg(() => {
            throw new Error("no source");
        });
        await plugin.api.document().catch(() => undefined);
        const logged: string[] = [];

        await serve(plugin, logged);

        expect(logged).toEqual(["[dtcg] no source"]);
    });
});
