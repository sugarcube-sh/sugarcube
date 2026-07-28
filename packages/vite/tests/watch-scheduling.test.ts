import { afterEach, describe, expect, it, vi } from "vitest";
import { createSingleFlight, debounce } from "../src/watch-scheduling.js";

function deferred() {
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("debounce", () => {
    afterEach(() => vi.useRealTimers());

    it("collapses a burst of calls into a single trailing invocation", () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const d = debounce(fn, 100);

        d();
        d();
        d();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("resets the timer on each call", () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const d = debounce(fn, 100);

        d();
        vi.advanceTimersByTime(80);
        d(); // resets — should not fire at the original 100ms mark
        vi.advanceTimersByTime(80);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(20);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("cancel() prevents a pending invocation from firing", () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const d = debounce(fn, 100);

        d();
        d.cancel();
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });
});

describe("createSingleFlight", () => {
    it("runs sequential (non-overlapping) calls in full", async () => {
        const calls: number[] = [];
        let n = 0;
        const run = createSingleFlight(async () => {
            calls.push(++n);
        });

        run();
        await Promise.resolve();
        run();
        await Promise.resolve();
        await Promise.resolve();

        expect(calls).toEqual([1, 2]);
    });

    it("does not run concurrently and coalesces triggers into one trailing run", async () => {
        const first = deferred();
        let active = 0;
        let maxActive = 0;
        let runs = 0;

        const run = createSingleFlight(async () => {
            runs++;
            active++;
            maxActive = Math.max(maxActive, active);
            if (runs === 1) await first.promise;
            active--;
        });

        run(); // starts, blocks on `first`
        run(); // in-flight → sets pending
        run(); // in-flight → pending already set, still just one trailing run
        await Promise.resolve();

        expect(maxActive).toBe(1); // never concurrent

        first.resolve();
        await first.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(runs).toBe(2); // one trailing run, not three
    });

    it("routes errors to onError and still drains a pending trigger", async () => {
        const first = deferred();
        const runs: string[] = [];
        const onError = vi.fn();

        const run = createSingleFlight(async () => {
            if (runs.length === 0) {
                runs.push("boom");
                await first.promise;
                throw new Error("boom");
            }
            runs.push("next");
        }, onError);

        run(); // in flight, will throw
        run(); // queued
        await Promise.resolve();

        first.resolve();
        await first.promise;
        await Promise.resolve();
        await Promise.resolve();

        expect(runs).toEqual(["boom", "next"]); // lock released despite the throw
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    });
});
