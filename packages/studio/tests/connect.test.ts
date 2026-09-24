import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeClient = { closed: boolean; close(): void };
const clients: FakeClient[] = [];
let settle: Array<() => void> = [];

vi.mock("devframe/client", () => ({
    connectDevframe: vi.fn(
        () =>
            new Promise((resolve) => {
                settle.push(() => {
                    const client = {
                        closed: false,
                        transport: "static" as const,
                        connectionMeta: { configs: {} },
                        sharedState: { get: async () => ({}) },
                        call: async () => {},
                        close() {
                            this.closed = true;
                        },
                    };
                    clients.push(client);
                    resolve(client);
                });
            }),
    ),
}));

import { connectStudio } from "../src/providers/rpc-client";

describe("one connection per mount", () => {
    beforeEach(() => {
        clients.length = 0;
        settle = [];
        vi.stubGlobal("window", { location: { href: "http://localhost:1234/__studio/" } });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("closes the connection of a mount that was abandoned while connecting, as StrictMode abandons the first", async () => {
        const first = new AbortController();
        const second = new AbortController();
        const a = connectStudio(first.signal);
        first.abort();
        const b = connectStudio(second.signal);
        for (const resolve of settle) resolve();

        await expect(a).rejects.toMatchObject({ name: "AbortError" });
        await b;

        expect(clients.map((client) => client.closed)).toEqual([true, false]);
    });

    it("closes the connection when its owner goes away later", async () => {
        const controller = new AbortController();
        const connecting = connectStudio(controller.signal);
        for (const resolve of settle) resolve();
        await connecting;

        controller.abort();

        expect(clients.map((client) => client.closed)).toEqual([true]);
    });
});
