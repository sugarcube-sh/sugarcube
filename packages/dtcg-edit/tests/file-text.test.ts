import { readFromMemory } from "@sugarcube-sh/dtcg";
import * as jsonc from "jsonc-parser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remove, setDescription, setValue } from "../src/index.js";

const resolver = JSON.stringify({
    version: "2025.10",
    resolutionOrder: [
        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
        {
            type: "modifier",
            name: "mode",
            default: "light",
            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
        },
    ],
});
const tokens = () =>
    readFromMemory({
        files: {
            "tokens.resolver.json": resolver,
            "base.json": '{ "n": { "$type": "number", "$value": 1, "$description": "One." } }',
            "dark.json": '{ "n": { "$type": "number", "$value": 2, "$description": "One." } }',
        },
        entryFile: "tokens.resolver.json",
    });

const parses = () => vi.spyOn(jsonc, "parseTree");

afterEach(() => {
    vi.restoreAllMocks();
});

describe("reading the design tokens' text", () => {
    it("parses each file an operation reads once", () => {
        const opened = tokens();
        const other = tokens();
        const counted = parses();
        setValue(opened, "n", 3);
        expect(counted).toHaveBeenCalledTimes(1);

        counted.mockClear();
        setDescription(other, "n", "Two.");
        expect(counted).toHaveBeenCalledTimes(2);
    });

    it("parses a file once for every operation on the same design tokens", () => {
        const opened = tokens();
        const counted = parses();
        setValue(opened, "n", 3);
        setDescription(opened, "n", "Two.");
        remove(opened, "n");

        expect(counted).toHaveBeenCalledTimes(2);
    });
});
