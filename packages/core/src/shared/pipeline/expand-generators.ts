/**
 * Materializes Sugarcube generator extensions into tree nodes during the
 * expand pass. A "generator" extension is one where the user authors a
 * recipe at a group level (e.g. sh.sugarcube.scale) and sugarcube
 * synthesizes the resulting child tokens at build time.
 *
 * Validation runs here too: a malformed scale recipe surfaces an
 * ExpandError, the group is left intact (without materialized children),
 * and the rest of the pipeline continues.
 */

import type { Token, TokenGroup } from "../../types/dtcg.js";
import type { ScaleExtension } from "../../types/extensions.js";
import type { TokenSource, TokenTree } from "../../types/tokens.js";
import { resolveScaleExtension } from "../scale/resolver.js";
import { validateScaleExtension } from "../validators/scale.js";
import type { ExpandError } from "./expand.js";

type GeneratorResult = {
    trees: TokenTree[];
    errors: ExpandError[];
};

export function expandGenerators(trees: TokenTree[]): GeneratorResult {
    const result: TokenTree[] = [];
    const errors: ExpandError[] = [];

    for (const tree of trees) {
        const source: TokenSource = {
            sourcePath: tree.sourcePath,
            ...(tree.context && { context: tree.context }),
        };

        if (!treeHasGenerators(tree.tokens)) {
            result.push(tree);
            continue;
        }

        const expanded = expandGroup(tree.tokens, [], source, errors);
        result.push({ ...tree, tokens: expanded });
    }

    return { trees: result, errors };
}

function treeHasGenerators(node: unknown): boolean {
    if (typeof node !== "object" || node === null) return false;
    const record = node as Record<string, unknown>;
    const ext = record.$extensions as Record<string, { scale?: unknown } | undefined> | undefined;
    if (ext?.["sh.sugarcube"]?.scale !== undefined) return true;
    for (const [key, value] of Object.entries(record)) {
        if (key.startsWith("$")) continue;
        if (treeHasGenerators(value)) return true;
    }
    return false;
}

function expandGroup(
    node: TokenGroup,
    path: string[],
    source: TokenSource,
    errors: ExpandError[]
): TokenGroup {
    const result: TokenGroup = { ...node };

    const sugarcube = node.$extensions?.["sh.sugarcube"] as { scale?: unknown } | undefined;
    const scaleExt = sugarcube?.scale;
    if (scaleExt !== undefined) {
        const errorPath = [...path, "$extensions", "sh.sugarcube", "scale"].join(".");
        const validationErrors = validateScaleExtension(scaleExt, errorPath, source);

        if (validationErrors.length > 0) {
            for (const err of validationErrors) {
                errors.push({
                    path: err.path,
                    message: err.message,
                    sourcePath: err.source.sourcePath,
                });
            }
        } else {
            const generated = resolveScaleExtension(scaleExt as ScaleExtension);
            for (const [name, token] of Object.entries(generated)) {
                if (name in result) continue;
                result[name] = token;
            }
        }
    }

    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith("$") && key !== "$root") continue;
        if (isToken(value)) continue;
        if (typeof value !== "object" || value === null) continue;
        result[key] = expandGroup(value as TokenGroup, [...path, key], source, errors);
    }

    return result;
}

function isToken(value: unknown): value is Token {
    return typeof value === "object" && value !== null && "$value" in value;
}
