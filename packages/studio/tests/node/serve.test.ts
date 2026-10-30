import { createServer, request } from "node:http";
import { studioDevframe } from "../../src/server/definition";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { STUDIO_PORT, serveFiles } from "../../src/node/serve";
import { filesAt } from "./demo";

vi.mock("devframe/utils/open", () => ({
    open: async () => {
        throw new Error("spawn xdg-open ENOENT");
    },
}));

describe("studioDevframe", () => {
    it("declares the studio route and dock without any host running", () => {
        const def = studioDevframe({ files: filesAt() });

        expect(def.id).toBe("studio");
        expect(def.basePath).toBe("/__sugarcube/studio/");
        expect(def.dock?.title).toBe("studio");
    });
});

describe("serveStudio", () => {
    let hub: Awaited<ReturnType<typeof serveFiles>>;

    beforeAll(async () => {
        hub = await serveFiles(await filesAt(), { port: 0 });
    }, 30_000);

    afterAll(async () => {
        await hub?.close();
    });

    it("listens on a real port", () => {
        expect(hub.port).toBeGreaterThan(0);
        expect(hub.origin).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it("says where studio opens and where its script is, and nothing about how it's served", () => {
        expect(Object.keys(hub).sort()).toStrictEqual([
            "close",
            "embedScriptUrl",
            "origin",
            "port",
            "studioUrl",
        ]);
        expect(hub.studioUrl).toBe(`${hub.origin}/__sugarcube/studio/`);
        expect(hub.embedScriptUrl).toBe(`${hub.origin}/__sugarcube/embedded.js`);
    });

    it("serves studio full width under the hub", async () => {
        const response = await fetch(hub.studioUrl);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("serves the connection descriptor the browser client fetches first", async () => {
        const response = await fetch(`${hub.origin}/__sugarcube/__connection.json`);

        expect(response.status).toBe(200);
        const meta = (await response.json()) as { backend?: string };
        expect(meta.backend).toBe("websocket");
    });

    it("serves the dock bootstrap a page on another port loads, with CORS for it", async () => {
        const response = await fetch(hub.embedScriptUrl, {
            headers: { Origin: "http://localhost:8080" },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:8080");
    });

    it("refuses a foreign origin", async () => {
        const response = await fetch(hub.embedScriptUrl, {
            headers: { Origin: "https://evil.example" },
        });

        expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("serves the page script the dock imports into the page, where the hub put it", async () => {
        const response = await fetch(
            `${hub.origin}/__sugarcube/studio/__page-script/page-script.mjs`,
            { headers: { Origin: "http://localhost:8080" } },
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toContain("export");
        expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:8080");
    });
});

function upgradeFrom(origin: string, url: string): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
        const asking = request(url, {
            headers: {
                "Origin": origin,
                "Connection": "Upgrade",
                "Upgrade": "websocket",
                "Sec-WebSocket-Version": "13",
                "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            },
        });
        asking.on("upgrade", (response, socket) => {
            socket.destroy();
            resolve(response.statusCode);
        });
        asking.on("response", (response) => {
            response.resume();
            resolve(response.statusCode);
        });
        asking.on("error", reject);
        asking.end();
    });
}

describe("serveStudio's live connection", () => {
    let hub: Awaited<ReturnType<typeof serveFiles>>;

    beforeAll(async () => {
        hub = await serveFiles(await filesAt(), { port: 0 });
    }, 30_000);

    afterAll(async () => {
        await hub?.close();
    });

    it("opens for a page on this machine", async () => {
        expect(await upgradeFrom("http://localhost:8080", `${hub.origin}/__sugarcube/__ws`)).toBe(
            101,
        );
    });

    it("stays shut to a site on the internet, which could otherwise save to the token files", async () => {
        expect(
            await upgradeFrom("https://evil.example", `${hub.origin}/__sugarcube/__ws`),
        ).not.toBe(101);
    });
});

describe("serveStudio, when things go wrong", () => {
    it("has a fixed port by default, so a pasted script tag keeps working", () => {
        expect(STUDIO_PORT).toBe(2823);
    });

    it("says so when the port asked for is taken, rather than waiting forever", async () => {
        const taken = createServer();
        await new Promise<void>((resolve) => taken.listen(0, "localhost", resolve));
        const address = taken.address();
        const port = typeof address === "object" && address ? address.port : 0;

        await expect(serveFiles(await filesAt(), { port })).rejects.toMatchObject({
            code: "EADDRINUSE",
        });

        await new Promise<void>((resolve) => taken.close(() => resolve()));
    });

    it("still serves when the browser cannot be opened", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const hub = await serveFiles(await filesAt(), { port: 0, open: true });

        expect((await fetch(hub.studioUrl)).status).toBe(200);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(hub.studioUrl));
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[sugarcube studio\] /));

        warn.mockRestore();
        await hub.close();
    });
});
