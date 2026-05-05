/**
 * Materialises sh.sugarcube.scale recipes into tree nodes during the
 * expand pass. A scale recipe is authored at a group level and sugarcube
 * synthesizes the resulting child tokens at build time.
 *
 * Validation runs here too: a malformed scale recipe surfaces an
 * ExpandError, the group is left intact (without materialised children),
 * and the rest of the pipeline continues.
 */

import type { TokenGroup } from "../../types/dtcg.js";
import type { ScaleExtension } from "../../types/extensions.js";
import type { TokenSource, TokenTree } from "../../types/tokens.js";
import { isToken } from "../guards.js";
import { resolveScaleExtension } from "../scale/resolver.js";
import { validateScaleExtension } from "../validators/scale.js";
import type { ExpandError } from "./expand.js";

type ExpandScaleResult = {
    trees: TokenTree[];
    errors: ExpandError[];
};

export function expandScale(trees: TokenTree[]): ExpandScaleResult {
    const result: TokenTree[] = [];
    const errors: ExpandError[] = [];

    for (const tree of trees) {
        const source: TokenSource = {
            sourcePath: tree.sourcePath,
            ...(tree.context && { context: tree.context }),
        };
        const path: string[] = [];
        const expanded = expandGroup(tree.tokens, path, source, errors);
        result.push(expanded === tree.tokens ? tree : { ...tree, tokens: expanded });
    }

    return { trees: result, errors };
}

function expandGroup(
    node: TokenGroup,
    path: string[],
    source: TokenSource,
    errors: ExpandError[]
): TokenGroup {
    let result: TokenGroup | null = null;

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
            for (const name in generated) {
                if (name in node) continue;
                if (result === null) result = { ...node };
                result[name] = generated[name];
            }
        }
    }

    for (const key in node) {
        if (key.startsWith("$") && key !== "$root") continue;
        const value = (node as Record<string, unknown>)[key];
        if (isToken(value)) continue;
        if (typeof value !== "object" || value === null) continue;
        path.push(key);
        const expanded = expandGroup(value as TokenGroup, path, source, errors);
        path.pop();
        if (expanded !== value) {
            if (result === null) result = { ...node };
            result[key] = expanded;
        }
    }

    return result ?? node;
}
