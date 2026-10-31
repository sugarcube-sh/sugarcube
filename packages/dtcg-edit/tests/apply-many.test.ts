import { readFromMemory } from "@sugarcube-sh/dtcg";
import * as jsonc from "jsonc-parser";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type FileOp,
    type OpResult,
    apply,
    combine,
    commit,
    create,
    remove,
    rename,
    setDescription,
    setValue,
} from "../src/index.js";
import { designTokens as sized } from "./benchmarks/design-tokens.js";
import { at, committed, demo } from "./helpers.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("applying many edits to one file", () => {
    it("gives what applying them one at a time gives", () => {
        const result = rename(demo, "color.brand", "primary");
        const ops = result.ops ? result.ops : [];
        const oneByOne = ops.reduce((tokens, op) => {
            const next = apply(tokens, [op]);
            if (next.conflicts) throw new Error(JSON.stringify(next.conflicts));
            return next.tokens;
        }, demo);
        const together = apply(demo, ops);
        if (together.conflicts) throw new Error(JSON.stringify(together.conflicts));
        expect(together.tokens.toMemory().files).toEqual(oneByOne.toMemory().files);
    });

    it("gives what applying them one at a time gives when they touch or sit inside each other", () => {
        const red = { colorSpace: "srgb", components: [1, 0, 0] };
        const steps: OpResult[] = [];
        let tokens = demo;
        for (const operation of [
            (p: typeof demo) => setValue(p, "color.brand.500", red),
            (p: typeof demo) => setDescription(p, "color.brand.500", "The anchor, again."),
            (p: typeof demo) => setValue(p, "color.brand.600", red),
            (p: typeof demo) => remove(p, "color.brand.400"),
            (p: typeof demo) => create(p, "color.brand.450", { $value: red }),
            (p: typeof demo) => setDescription(p, "color.brand", "Renamed soon."),
            (p: typeof demo) => rename(p, "color.brand", "house"),
            (p: typeof demo) => setValue(p, "color.house.700", red),
        ]) {
            const result = operation(tokens);
            steps.push(result);
            const done = commit(tokens, result);
            if (!done.tokens) throw new Error(JSON.stringify(done));
            tokens = done.tokens;
        }
        const ops = steps.flatMap((step) => (step.ops ? step.ops : []));
        const together = apply(demo, ops);
        if (together.conflicts) throw new Error(JSON.stringify(together.conflicts));
        expect(together.tokens.toMemory().files).toEqual(tokens.toMemory().files);
    });

    it("removes neighbouring tokens together as one at a time does, leaving valid JSON", () => {
        const layouts = [
            '{\n  "n": {\n    "$type": "number",\n    "a": { "$value": 0 },\n    "b": { "$value": 1 },\n    "c": { "$value": 2 }\n  }\n}\n',
            '{"n": {"$type":"number","a":{"$value":0},"b":{"$value":1},"c":{"$value":2}}}',
        ];
        for (const text of layouts) {
            for (const paths of [
                ["n.b", "n.c"],
                ["n.a", "n.b"],
                ["n.a", "n.b", "n.c"],
                ["n.c", "n.b"],
            ]) {
                const tokens = readFromMemory({ files: { "tokens.json": text } });
                let oneByOne = tokens;
                const ops: FileOp[] = [];
                for (const path of paths) {
                    const result = remove(oneByOne, path);
                    if (!result.ops) throw new Error(JSON.stringify(result));
                    ops.push(...result.ops);
                    const next = apply(oneByOne, result.ops);
                    if (next.conflicts) throw new Error(JSON.stringify(next.conflicts));
                    oneByOne = next.tokens;
                }
                const together = apply(tokens, ops);
                if (together.conflicts) throw new Error(JSON.stringify(together.conflicts));
                expect(together.tokens.text("tokens.json")).toBe(oneByOne.text("tokens.json"));
                expect(together.tokens.diagnostics.map(({ kind }) => kind)).toStrictEqual([]);
            }
        }
    });

    it("gives what applying them one at a time gives, for random mixes of removals, values and renames", () => {
        const layouts = [
            '{\n  "n": {\n    "$type": "number",\n    "a": { "$value": 0 },\n    "b": { "$value": 1 },\n    "c": { "$value": 2 },\n    "d": { "$value": 3 }\n  }\n}\n',
            '{"n": {"$type":"number","a":{"$value":0},"b":{"$value":1},"c":{"$value":2},"d":{"$value":3}}}',
            '{\n  "n": {\n    "$type": "number",\n    "a": {\n      "$value": 0\n    },\n    "b": {\n      "$value": 1\n    },\n    "c": { "$value": 2 }, "d": { "$value": 3 }\n  }\n}\n',
        ];
        let seed = 7;
        const pick = (count: number) => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed % count;
        };
        for (let round = 0; round < 100; round++) {
            const tokens = readFromMemory({ files: { "t.json": layouts[pick(layouts.length)]! } });
            let oneByOne = tokens;
            const ops: FileOp[] = [];
            for (let step = 0; step < 2 + pick(3); step++) {
                const paths = oneByOne.tokenPaths();
                const path = paths[pick(paths.length)];
                if (path === undefined) break;
                const choice = pick(3);
                const result =
                    choice === 0
                        ? remove(oneByOne, path)
                        : choice === 1
                          ? setValue(oneByOne, path, pick(100))
                          : rename(oneByOne, path, `r${step}`);
                if (!result.ops) continue;
                ops.push(...result.ops);
                oneByOne = committed(oneByOne, result);
            }
            const together = apply(tokens, ops);
            if (together.conflicts) throw new Error(JSON.stringify(together.conflicts));
            expect(together.tokens.text("t.json")).toBe(oneByOne.text("t.json"));
        }
    });

    it("removes every unused token of the demo in one step without breaking a file", () => {
        const unused = demo
            .tokenPaths()
            .filter((path) => demo.permutations.every((p) => p.usedBy(path).length === 0));
        const done = commit(
            demo,
            combine(
                demo,
                unused.map((path) => (current) => remove(current, path)),
            ),
        );

        expect(
            done.tokens?.diagnostics.filter(({ kind }) => kind === "invalid-json"),
        ).toStrictEqual([]);
    });

    it("refuses a second key renamed to the name the first just took", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.json":
                    '{ "a": { "$type": "number", "$value": 1 }, "b": { "$type": "number", "$value": 2 } }',
            },
        });
        const renamedTo = (key: string): FileOp => ({
            kind: "renameKey",
            file: "tokens.json",
            jsonPath: [key],
            name: "x",
            was: at(tokens, "tokens.json", [key]) ?? null,
        });

        expect(apply(tokens, [renamedTo("a"), renamedTo("b")])).toEqual({
            conflicts: [expect.objectContaining({ kind: "taken" })],
        });
    });

    it("refuses an edit through a key an earlier edit renamed", () => {
        const tokens = readFromMemory({
            files: { "tokens.json": '{\n  "a": { "$type": "number", "$value": 1 }\n}\n' },
        });
        const ops: FileOp[] = [
            {
                kind: "renameKey",
                file: "tokens.json",
                jsonPath: ["a"],
                name: "b",
                was: at(tokens, "tokens.json", ["a"]) ?? null,
            },
            { kind: "set", file: "tokens.json", jsonPath: ["a", "$value"], value: 2, was: 1 },
        ];

        expect(apply(tokens, ops)).toEqual({
            conflicts: [expect.objectContaining({ kind: "gone" })],
        });
    });

    it("deletes a file as an earlier edit in the same list left it", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                    ],
                }),
                "base.json": '{\n  "a": { "$type": "number", "$value": 1 }\n}\n',
            },
        });
        const edited = '{\n  "a": { "$type": "number", "$value": 2 }\n}\n';
        const ops: FileOp[] = [
            { kind: "set", file: "base.json", jsonPath: ["a", "$value"], value: 2, was: 1 },
            { kind: "deleteFile", file: "base.json", was: edited },
        ];
        const after = apply(tokens, ops);
        if (after.conflicts) throw new Error(JSON.stringify(after.conflicts));
        expect(after.tokens.text("base.json")).toBeUndefined();
    });

    it("parses a file a few times, not once an edit", () => {
        const opened = sized(60);
        const result = rename(opened, "color", "colour");
        const ops = result.ops ? result.ops : [];
        const counted = vi.spyOn(jsonc, "parseTree");
        apply(opened, ops);

        expect(ops.length).toBeGreaterThan(40);
        expect(counted.mock.calls.length).toBeLessThan(20);
    });
});
