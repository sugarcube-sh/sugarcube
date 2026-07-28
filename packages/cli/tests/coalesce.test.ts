import { describe, expect, it, vi } from "vitest";
import { createCoalescedRunner } from "../src/watch/coalesce.js";

// A deferred promise so tests control exactly when a run resolves.
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

        run(1); // starts, blocks on `first`
        run(2); // queued, must not start yet
        await Promise.resolve();

        expect(Math.max(...active)).toBe(1); // never two at once

        first.resolve();
        await first.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(active).toEqual([1, 1]); // the queued run fired after the first
    });

    it("coalesces multiple queued calls into one trailing run with the latest args", async () => {
        const first = deferred();
        const seen: string[] = [];

        const run = createCoalescedRunner(async (arg: string) => {
            seen.push(arg);
            if (arg === "start") await first.promise;
        }, vi.fn());

        run("start"); // in flight
        run("dropped"); // queued
        run("latest"); // overwrites queue slot
        await Promise.resolve();

        first.resolve();
        await first.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(seen).toEqual(["start", "latest"]); // "dropped" collapsed away
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

        run("boom"); // in flight, will reject
        run("next"); // queued
        await Promise.resolve();

        first.resolve();
        await first.promise.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
        expect(seen).toEqual(["boom", "next"]); // lock released despite the error
    });
});
