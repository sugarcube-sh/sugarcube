import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChangeKind, createChangeQueue } from "../src/watch/watcher.js";

function recorder() {
    const runs: Array<[ChangeKind, string]> = [];
    let release: (() => void) | null = null;
    return {
        runs,
        callbacks: {
            onChange: async (kind: ChangeKind, path: string) => {
                runs.push([kind, path]);
                if (release === null) return;
                await new Promise<void>((resolve) => {
                    release = resolve;
                });
            },
            onError: () => {},
        },
        holdNextRun: () => {
            release = () => {};
        },
        releaseRun: () => {
            const done = release;
            release = null;
            done?.();
        },
    };
}

const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("the change queue", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("collapses a burst of changes to one file into one run", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        queue("markup", "a.html");
        queue("markup", "a.html");
        await vi.advanceTimersByTimeAsync(100);

        expect(r.runs).toEqual([["markup", "a.html"]]);
    });

    it("does not lose a token change when a markup change lands in the same window", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        queue("token", "tokens/color.json");
        queue("markup", "src/page.tsx");
        await vi.advanceTimersByTimeAsync(100);
        await settle();

        expect(r.runs.map(([kind]) => kind)).toContain("token");
    });

    it("does not lose a token change that arrives while a markup run is in flight", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        r.holdNextRun();
        queue("markup", "src/page.tsx");
        await vi.advanceTimersByTimeAsync(100);
        queue("token", "tokens/color.json");
        await vi.advanceTimersByTimeAsync(100);
        queue("markup", "src/other.tsx");
        await vi.advanceTimersByTimeAsync(100);
        r.releaseRun();
        await settle();

        expect(r.runs.map(([kind]) => kind)).toContain("token");
    });

    it("runs the token change first when both are pending", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        queue("markup", "src/page.tsx");
        queue("token", "tokens/color.json");
        await vi.advanceTimersByTimeAsync(100);
        await settle();

        expect(r.runs[0]?.[0]).toBe("token");
    });

    it("runs a config change before token and markup changes", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        queue("markup", "src/page.tsx");
        queue("token", "tokens/color.json");
        queue("config", "sugarcube.config.ts");
        await vi.advanceTimersByTimeAsync(100);
        await settle();

        expect(r.runs.map(([kind]) => kind)).toEqual(["config", "token", "markup"]);
    });
});
