import { describe, expect, it, vi } from "vitest";
import { createCoalescedRunner } from "../src/watch/coalesce.js";

function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("createCoalescedRunner", () => {
    it("runs sequential (non-overlapping) calls in full", async () => {
        const calls: string[] = [];
        const run = createCoalescedRunner(async (arg: string) => {
            calls.push(arg);
        }, vi.fn());

        run("a");
        await Promise.resolve();
        run("b");
        await Promise.resolve();
        await Promise.resolve();

        expect(calls).toEqual(["a", "b"]);
    });

    it("does not start a second run while one is in flight", async () => {
        const first = deferred();
        const active: number[] = [];
        let concurrent = 0;

        const run = createCoalescedRunner(async (id: number) => {
            concurrent++;
            active.push(concurrent);
            await (id === 1 ? first.promise : Promise.resolve());
            concurrent--;
        }, vi.fn());

        run(1);
        run(2);
        await Promise.resolve();

        expect(Math.max(...active)).toBe(1);

        first.resolve();
        await first.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(active).toEqual([1, 1]);
    });

    it("coalesces multiple queued calls into one trailing run with the latest args", async () => {
        const first = deferred();
        const seen: string[] = [];

        const run = createCoalescedRunner(async (arg: string) => {
            seen.push(arg);
            if (arg === "start") await first.promise;
        }, vi.fn());

        run("start");
        run("dropped");
        run("latest");
        await Promise.resolve();

        first.resolve();
        await first.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(seen).toEqual(["start", "latest"]);
    });

    it("routes errors to onError and still drains the queue", async () => {
        const onError = vi.fn();
        const first = deferred();
        const seen: string[] = [];

        const run = createCoalescedRunner(async (arg: string) => {
            seen.push(arg);
            if (arg === "boom") {
                await first.promise;
                throw new Error("boom");
            }
        }, onError);

        run("boom");
        run("next");
        await Promise.resolve();

        first.resolve();
        await first.promise.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
        expect(seen).toEqual(["boom", "next"]);
    });
});
