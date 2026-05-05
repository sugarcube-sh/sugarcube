/**
 * Guards the PathIndex refresh: a wrong implementation here means
 * either no rebuild ever fires (the bug we just fixed comes back) or
 * one fires on every value-only edit (perf regression). Both directions
 * are covered.
 */

import { describe, expect, it } from "vitest";
import { sameKeySet } from "../src/tokens/same-key-set";

const iter = (xs: string[]): IterableIterator<string> => xs[Symbol.iterator]();

describe("sameKeySet", () => {
    it("is true when both sides have the same keys in the same order", () => {
        expect(sameKeySet(iter(["a", "b", "c"]), ["a", "b", "c"])).toBe(true);
    });

    it("is true when keys match but order differs", () => {
        expect(sameKeySet(iter(["c", "a", "b"]), ["a", "b", "c"])).toBe(true);
    });

    it("is false when a key is added", () => {
        expect(sameKeySet(iter(["a", "b"]), ["a", "b", "c"])).toBe(false);
    });

    it("is false when a key is removed", () => {
        expect(sameKeySet(iter(["a", "b", "c"]), ["a", "b"])).toBe(false);
    });

    it("is false when one side has duplicates that the other doesn't", () => {
        // Set vs. array semantics: ["a","a"] becomes {"a"}, length 1; b is length 2.
        expect(sameKeySet(iter(["a", "a"]), ["a", "b"])).toBe(false);
    });

    it("is true for two empty sides", () => {
        expect(sameKeySet(iter([]), [])).toBe(true);
    });
});
