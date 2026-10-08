import { describe, expect, it } from "vitest";
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
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("the change queue", () => {
    it("starts a run at once, without waiting", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        queue("token", "tokens/color.json");
        await settle();

        expect(r.runs).toEqual([["token", "tokens/color.json"]]);
    });

    it("runs once more for the changes that arrive during a run, however many", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        r.holdNextRun();
        queue("markup", "src/page.tsx");
        await settle();
        queue("markup", "src/other.tsx");
        queue("token", "tokens/color.json");
        queue("markup", "src/last.tsx");
        r.releaseRun();
        await settle();

        expect(r.runs).toEqual([
            ["markup", "src/page.tsx"],
            ["token", "tokens/color.json"],
            ["markup", "src/last.tsx"],
        ]);
    });

    it("takes config, then tokens, then markup from the changes that arrived during a run", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        r.holdNextRun();
        queue("token", "tokens/color.json");
        await settle();
        queue("markup", "src/page.tsx");
        queue("token", "tokens/dark.json");
        queue("config", "sugarcube.config.ts");
        r.releaseRun();
        await settle();

        expect(r.runs.slice(1).map(([kind]) => kind)).toEqual(["config", "token", "markup"]);
    });
});
