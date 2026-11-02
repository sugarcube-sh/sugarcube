import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
    type DesignTokens,
    type JsonPath,
    type ReadOptions,
    readFromMemory,
    type JsonValue,
} from "@sugarcube-sh/dtcg";
import { type Clash, type Edits, type FileOp, type OpResult, commit } from "../src/index.js";
import { removeAt, setAt } from "../src/text-edits.js";

const folder = join(import.meta.dirname, "fixtures/demo");

export const demo = readFromMemory({
    files: Object.fromEntries(
        readdirSync(folder).map((name) => [name, readFileSync(join(folder, name), "utf8")]),
    ),
    entryFile: "tokens.resolver.json",
});

export const at = (tokens: DesignTokens, file: string, jsonPath: JsonPath): JsonValue | undefined =>
    jsonPath.reduce((value, step) => value?.[step], JSON.parse(tokens.getText(file) ?? "null"));

export function plainly(result: OpResult) {
    return result.ops ? { ...result, alsoAffects: result.alsoAffects.inputs } : result;
}

export function opsOf(result: OpResult): readonly FileOp[] {
    if (!result.ops) throw new Error(JSON.stringify(result));
    return result.ops;
}

export function committed(tokens: DesignTokens, result: OpResult): DesignTokens {
    const done = commit(tokens, result);
    if (!done.tokens) throw new Error(JSON.stringify(done));
    return done.tokens;
}

export const resolver = (sources: object[], contexts: Record<string, object[]> = {}) =>
    JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources },
            ...(Object.keys(contexts).length > 0
                ? [{ type: "modifier", name: "mode", default: "light", contexts }]
                : []),
        ],
    });

export const opened = (files: Record<string, string>, options?: ReadOptions) =>
    readFromMemory({ files, entryFile: "tokens.resolver.json" }, options);

export function changed(
    tokens: DesignTokens,
    changes: [file: string, jsonPath: JsonPath, value: JsonValue | undefined][],
): DesignTokens {
    const texts: Record<string, string> = {};
    for (const [file, jsonPath, value] of changes) {
        const text = texts[file] ?? tokens.getText(file) ?? "";
        const edited =
            value === undefined ? removeAt(text, jsonPath) : setAt(text, jsonPath, value);
        if (edited === undefined) throw new Error("the test's own edit could not be made");
        texts[file] = edited;
    }
    return tokens.reread(texts);
}

export const opsIn = (edits: Edits): readonly FileOp[] => edits.steps.flatMap((step) => step.ops);

export const asEdits = (ops: readonly FileOp[]): Edits => ({ steps: [{ ops, moved: [] }] });

export const partsOf = (clashes: readonly Clash[]) => clashes.flatMap((clash) => clash.parts);
