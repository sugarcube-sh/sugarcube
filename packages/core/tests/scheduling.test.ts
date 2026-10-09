import { describe, expect, it } from "vitest";
import { createChangeQueue } from "../src/shared/scheduling.js";

type Change = { kind: "config" | "token" | "markup"; name: string };

const IN_ORDER: Change["kind"][] = ["config", "token", "markup"];
const config = (name: string): Change => ({ kind: "config", name });
const markup = (name: string): Change => ({ kind: "markup", name });
const token = (name: string): Change => ({ kind: "token", name });

const named = (change: Change) => change.name;

function recorder() {
    const runs: Array<[Change["kind"], string]> = [];
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

describe("a queue of changes run one at a time", () => {
    it("starts a run at once, without waiting", async () => {
        const r = recorder();
        const queue = createChangeQueue(IN_ORDER, r.callbacks);

        queue(token("color.json"));
        await settle();

        expect(r.runs).toEqual([["token", "color.json"]]);
    });

    it("runs once more for the changes that arrive during a run, however many", async () => {
        const r = recorder();
        const queue = createChangeQueue(IN_ORDER, r.callbacks);

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
        const queue = createChangeQueue(IN_ORDER, r.callbacks);

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
        const runs: string[] = [];
        let release = () => {};
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        const queue = createChangeQueue<Change>(IN_ORDER, {
            onChange: async (change: Change) => {
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
        const queue = createChangeQueue<Change>(IN_ORDER, {
            onChange: async ({ kind }: Change) => {
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

    it("runs a queue of one kind once more, with the newest change that waited", async () => {
        const r = recorder();
        const queue = createChangeQueue<Change>(["config"], r.callbacks);

        r.holdNextRun();
        queue(config("first"));
        await settle();
        queue(config("second"));
        queue(config("third"));
        r.releaseRun();
        await settle();

        expect(r.runs).toEqual([
            ["config", "first"],
            ["config", "third"],
        ]);
    });
});
