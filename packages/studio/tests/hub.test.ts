import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SUGARCUBE_API_PLUGIN_NAME } from "@sugarcube-sh/vite";
import { type Plugin, type ViteDevServer, createServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveFiles } from "../src/node/serve";
import { STUDIO_ICON } from "../src/server/icon";
import sugarcubeStudio from "../src/vite/plugin";
import { filesAt } from "./node/demo";

type Branding = { productName?: string; logo?: string };

async function brandingAt(origin: string): Promise<Branding | undefined> {
    const response = await fetch(`${origin}/__sugarcube/__connection.json`);
    const meta = (await response.json()) as { configs?: { ui?: { branding?: Branding } } };
    return meta.configs?.ui?.branding;
}

const sugarcube = { productName: "sugarcube", logo: STUDIO_ICON };

describe("the dock studio sits in", () => {
    describe("served on a port of its own", () => {
        let hub: Awaited<ReturnType<typeof serveFiles>>;

        beforeAll(async () => {
            hub = await serveFiles(await filesAt(), { port: 0 });
        }, 30_000);

        afterAll(async () => {
            await hub?.close();
        });

        it("wears sugarcube's name and logo", async () => {
            expect(await brandingAt(hub.origin)).toStrictEqual(sugarcube);
        });
    });

    describe("in a Vite dev server", () => {
        let root: string;
        let server: ViteDevServer;

        beforeAll(async () => {
            root = mkdtempSync(join(tmpdir(), "studio-under-vite-"));
            const files = await filesAt();
            const context = { ...files.now(), onReload: files.onChange };
            const sugarcubePlugin: Plugin = {
                name: SUGARCUBE_API_PLUGIN_NAME,
                api: { getContext: () => context },
            };
            server = await createServer({
                root,
                configFile: false,
                logLevel: "silent",
                server: { port: 0, host: "localhost" },
                plugins: [sugarcubePlugin, sugarcubeStudio()],
            });
            await server.listen();
        }, 30_000);

        afterAll(async () => {
            await server?.close();
            rmSync(root, { recursive: true, force: true });
        });

        it("wears sugarcube's name and logo", async () => {
            const origin = server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "";

            expect(await brandingAt(origin)).toStrictEqual(sugarcube);
        });
    });
});
