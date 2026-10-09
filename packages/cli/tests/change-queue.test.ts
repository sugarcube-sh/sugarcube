import type { Document } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { type Change, createChangeQueue } from "../src/watch/watcher.js";

const config = (path: string): Change => ({ kind: "config", path });
const markup = (path: string): Change => ({ kind: "markup", path });
const token = (file: string): Change => ({
    kind: "token",
    doc: { files: [file] } as unknown as Document,
    read: { file, ms: 0 },
});

const named = (change: Change) => (change.kind === "token" ? change.read.file : change.path);

function recorder() {
    const runs: Array<[Change["kind"], string | undefined]> = [];
    let release: (() => void) | null = null;
    return {
        runs,
        callbacks: {
            onChange: async (change: Change) => {
                runs.push([change.kind, named(change)]);
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

        queue(token("color.json"));
        await settle();

        expect(r.runs).toEqual([["token", "color.json"]]);
    });

    it("runs once more for the changes that arrive during a run, however many", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        r.holdNextRun();
        queue(markup("src/page.tsx"));
        await settle();
        queue(markup("src/other.tsx"));
        queue(token("color.json"));
        queue(markup("src/last.tsx"));
        r.releaseRun();
        await settle();

        expect(r.runs).toEqual([
            ["markup", "src/page.tsx"],
            ["token", "color.json"],
            ["markup", "src/last.tsx"],
        ]);
    });

    it("takes config, then tokens, then markup from the changes that arrived during a run", async () => {
        const r = recorder();
        const queue = createChangeQueue(r.callbacks);

        r.holdNextRun();
        queue(token("color.json"));
        await settle();
        queue(markup("src/page.tsx"));
        queue(token("dark.json"));
        queue(config("sugarcube.config.ts"));
        r.releaseRun();
        await settle();

        expect(r.runs.slice(1).map(([kind]) => kind)).toEqual(["config", "token", "markup"]);
    });

    it("runs a token change that arrives during a config change in place of the one waiting", async () => {
        const runs: Array<string | undefined> = [];
        let release = () => {};
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        const queue = createChangeQueue({
            onChange: async (change) => {
                runs.push(named(change));
                if (change.kind === "config") await held;
            },
            onError: () => {},
        });

        queue(markup("src/page.html"));
        queue(config("sugarcube.config.ts"));
        queue(token("old.json"));
        await settle();
        queue(token("new.json"));
        release();
        await settle();

        expect(runs).toEqual(["src/page.html", "sugarcube.config.ts", "new.json"]);
    });

    it("reports a change that fails, and still runs the ones after it", async () => {
        const runs: Change["kind"][] = [];
        const errors: unknown[] = [];
        let release = () => {};
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        const queue = createChangeQueue({
            onChange: async ({ kind }) => {
                runs.push(kind);
                if (kind === "markup") await held;
                if (kind === "config") throw new Error("the config broke");
            },
            onError: (error) => errors.push(error),
        });

        queue(markup("src/page.html"));
        await settle();
        queue(token("color.json"));
        queue(config("sugarcube.config.ts"));
        release();
        await settle();

        expect(runs).toEqual(["markup", "config", "token"]);
        expect(errors).toEqual([new Error("the config broke")]);
    });
});
