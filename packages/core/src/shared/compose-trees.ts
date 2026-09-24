import type { TokenGroup } from "../types/dtcg.js";
import type { TokenSources } from "../types/load.js";
import type { TokenTree } from "../types/tokens.js";
import { ErrorMessages } from "./constants/error-messages.js";
import { isGroup, isToken } from "./guards.js";
import { resolveJsonPointer } from "./json-pointer.js";

/**
 * Deep merge two token groups.
 * Later values override earlier ones at the same path.
 * Objects are recursively merged, but tokens ($value) are replaced entirely.
 */
export function deepMerge(target: TokenGroup, source: TokenGroup): TokenGroup {
    const result: TokenGroup = { ...target };

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined) continue;

        // $ properties are metadata so we just copy them
        if (key.startsWith("$")) {
            result[key] = value as TokenGroup[typeof key];
            continue;
        }

        // Replace tokens entirely
        if (isToken(value)) {
            result[key] = value as TokenGroup[typeof key];
            continue;
        }

        const existing = result[key];
        const shouldMerge =
            existing !== undefined &&
            typeof existing === "object" &&
            existing !== null &&
            typeof value === "object" &&
            value !== null &&
            !isToken(existing);

        result[key] = shouldMerge
            ? deepMerge(existing as TokenGroup, value as TokenGroup)
            : (value as TokenGroup[typeof key]);
    }

    return result;
}

/**
 * Recursively stamp `$sourcePath` on every token and every group in a token group.
 * This preserves per-file attribution through deep merges.
 */
export function stampSourcePath(group: TokenGroup, sourcePath: string): TokenGroup {
    const result: TokenGroup = {};

    for (const [key, value] of Object.entries(group)) {
        if (value === undefined) continue;

        if (key.startsWith("$")) {
            result[key] = value as TokenGroup[typeof key];
            continue;
        }

        if (isToken(value)) {
            result[key] = { ...value, $sourcePath: sourcePath } as TokenGroup[typeof key];
        } else if (isGroup(value)) {
            result[key] = {
                ...stampSourcePath(value as TokenGroup, sourcePath),
                $sourcePath: sourcePath,
            } as TokenGroup[typeof key];
        } else {
            result[key] = value as TokenGroup[typeof key];
        }
    }

    return result;
}

export type ComposeError = {
    path: string;
    message: string;
};

export type Composed = {
    trees: TokenTree[];
    errors: ComposeError[];
};

/**
 * The trees the resolver path would produce, from file text alone. This is the
 * plain merge in resolution order; `extending`, `emit: false` and inline
 * modifiers are the resolver's and are not applied here.
 */
export function composeTrees(sources: TokenSources): Composed {
    const trees: TokenTree[] = [];
    const errors: ComposeError[] = [];
    const parsed = new Map<string, unknown>();

    for (const { context, sources: refs } of sources.order) {
        let tokens: TokenGroup = {};

        for (const { file, pointer } of refs) {
            const text = sources.files[file];
            if (text === undefined) {
                errors.push({ path: file, message: ErrorMessages.LOAD.NO_SOURCE_TEXT(file) });
                continue;
            }

            let content = parsed.get(file);
            if (content === undefined) {
                try {
                    content = JSON.parse(text);
                    parsed.set(file, content);
                } catch (error) {
                    errors.push({
                        path: file,
                        message: error instanceof Error ? error.message : String(error),
                    });
                    continue;
                }
            }

            let group = content;
            if (pointer !== undefined) {
                const found = resolveJsonPointer(content, pointer);
                if (found.error !== undefined) {
                    errors.push({
                        path: file,
                        message: ErrorMessages.LOAD.POINTER_NOT_FOUND(file, pointer, found.error),
                    });
                    continue;
                }
                group = found.value;
            }

            tokens = deepMerge(tokens, stampSourcePath(group as TokenGroup, file));
        }

        if (Object.keys(tokens).length === 0) continue;

        trees.push({ context, tokens, sourcePath: refs[0]?.file ?? "" });
    }

    return { trees, errors };
}
