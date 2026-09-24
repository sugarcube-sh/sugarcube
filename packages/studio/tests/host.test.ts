import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { snapshotFromDisk, waitForSharedState } from "../src/host/connected-init";
import { readOpsStash, writeOpsStash } from "../src/host/ops-stash";
import { saveOverHttp } from "../src/host/save-over-http";
import type { SaveBundle } from "../src/host/types";
import type { WriteOp } from "../src/tokens/write-ops";

const OP: WriteOp = { kind: "set", file: "a.json", path: ["x", "$value"], value: 1 };
const BUNDLE: SaveBundle = { title: "", description: "", files: [] };

function storageStub() {
    const memory = new Map<string, string>();
    return {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
            memory.set(key, value);
        },
        removeItem: (key: string) => {
            memory.delete(key);
        },
        size: () => memory.size,
    };
}

describe("the stash of unsaved operations", () => {
    let storage: ReturnType<typeof storageStub>;

    beforeEach(() => {
        storage = storageStub();
        vi.stubGlobal("window", { sessionStorage: storage });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("holds what was written, for the same project", async () => {
        await writeOpsStash("p", [OP]);
        expect(await readOpsStash("p")).toEqual([OP]);
        expect(await readOpsStash("q")).toBeNull();
    });

    it("is emptied by an empty list, which is what a save or a discard sends", async () => {
        await writeOpsStash("p", [OP]);
        await writeOpsStash("p", []);
        expect(storage.size()).toBe(0);
    });

    it("drops a stash it cannot decode, rather than crashing on it", async () => {
        storage.setItem("sugarcube:studio:ops:p", "not-gzip");
        expect(await readOpsStash("p")).toBeNull();
        expect(storage.size()).toBe(0);
    });

    it("keeps the latest list when writes overlap: an edit, then the save that empties it", async () => {
        const edit = writeOpsStash("p", [OP]);
        const saved = writeOpsStash("p", []);
        await Promise.all([edit, saved]);

        expect(await readOpsStash("p")).toBeNull();
    });

    it("keeps the latest list when two edits overlap", async () => {
        const second: WriteOp = { ...OP, value: 2 };
        await Promise.all([writeOpsStash("p", [OP]), writeOpsStash("p", [second])]);

        expect(await readOpsStash("p")).toEqual([second]);
    });
});

describe("a save with no server behind Studio", () => {
    afterEach(() => vi.unstubAllGlobals());

    const answer = (status: number, body: unknown) =>
        vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status }));

    it("reports the pull request the service opened", async () => {
        answer(200, { number: 7, url: "https://example.test/pull/7" });
        expect(await saveOverHttp("https://save.test", BUNDLE)).toEqual({
            kind: "pr-submitted",
            number: 7,
            url: "https://example.test/pull/7",
        });
    });

    it("reports the service's own reason when it refuses", async () => {
        answer(422, { error: "Nothing to save", detail: "the branch is up to date" });
        expect(await saveOverHttp("https://save.test", BUNDLE)).toEqual({
            kind: "failed",
            error: "Nothing to save: the branch is up to date",
        });
    });

    it("reports an answer that names no pull request as a failure", async () => {
        answer(200, { ok: true });
        expect((await saveOverHttp("https://save.test", BUNDLE)).kind).toBe("failed");
    });

    it("gives up on a service that never answers, so the edits stay here for another try", async () => {
        vi.stubGlobal(
            "fetch",
            (_url: string, init: RequestInit) =>
                new Promise((_, reject) => {
                    init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
                }),
        );

        const result = await saveOverHttp("https://save.test", BUNDLE, 20);

        expect(result.kind).toBe("failed");
    });
});

describe("waiting for the host's shared state", () => {
    type Listener = (value: unknown) => void;
    function handle(initial: unknown) {
        let value = initial;
        const listeners = new Set<Listener>();
        return {
            value: () => value,
            on: (_event: "updated", listener: Listener) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            publish: (next: unknown) => {
                value = next;
                for (const listener of listeners) listener(next);
            },
        };
    }
    const ready = { config: {}, trees: [], resolved: {} };

    it("returns at once when the state is already there", async () => {
        await expect(
            waitForSharedState(handle(ready), new AbortController().signal),
        ).resolves.toBeUndefined();
    });

    it("returns when the state arrives", async () => {
        const disk = handle(undefined);
        const waiting = waitForSharedState(disk, new AbortController().signal);
        disk.publish(ready);
        await expect(waiting).resolves.toBeUndefined();
    });

    it("stops when told to", async () => {
        const controller = new AbortController();
        const waiting = waitForSharedState(handle(undefined), controller.signal);
        controller.abort();
        await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    });

    it("gives up after the bound, rather than waiting on a host that never publishes", async () => {
        await expect(
            waitForSharedState(handle(undefined), new AbortController().signal, 10),
        ).rejects.toThrow("Timed out");
    });
});

describe("the snapshot off what the host published", () => {
    const published = {
        config: {} as never,
        trees: [],
        resolved: {},
        defaultContext: "light",
        permutations: [],
        sources: { files: {}, order: [] },
    };

    it("is the working shape when the host has files", () => {
        expect(snapshotFromDisk(published)).toEqual(published);
    });

    it("is nothing when the host has no files to edit", () => {
        expect(snapshotFromDisk({ ...published, sources: null })).toBeNull();
    });
});
