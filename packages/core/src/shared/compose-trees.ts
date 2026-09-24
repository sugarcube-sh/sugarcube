import type { TokenGroup } from "../types/dtcg.js";
import type { SourceRef, TokenSources } from "../types/load.js";
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
 * Rebuilds the trees from file text alone, merging each context's sources in
 * order. Doesn't apply `extending`, `emit: false` or inline modifiers; that's
 * the resolver's job.
 */
export function composeTrees(sources: TokenSources): Composed {
    const trees: TokenTree[] = [];
    const errors: ComposeError[] = [];
    const read = sourceReader(sources, errors);

    for (const { context, sources: refs } of sources.order) {
        let tokens: TokenGroup = {};

        for (const ref of refs) {
            const group = read(ref);
            if (group === undefined) continue;
            tokens = deepMerge(tokens, stampSourcePath(group, ref.file));
        }

        if (Object.keys(tokens).length > 0) {
            trees.push({ context, tokens, sourcePath: refs[0]?.file ?? "" });
        }
    }

    return { trees, errors };
}

// Each file is parsed once and each failure reported once, however many
// contexts use it.
function sourceReader(
    sources: TokenSources,
    errors: ComposeError[],
): (ref: SourceRef) => TokenGroup | undefined {
    const contents = new Map<string, unknown>();
    const groups = new Map<string, TokenGroup | undefined>();

    const contentOf = (file: string): unknown => {
        if (!contents.has(file)) contents.set(file, parse(file, sources.files[file], errors));
        return contents.get(file);
    };

    const groupOf = ({ file, pointer }: SourceRef): TokenGroup | undefined => {
        const content = contentOf(file);
        if (content === undefined) return undefined;
        if (pointer === undefined) return content as TokenGroup;

        const found = resolveJsonPointer(content, pointer);
        if (found.error === undefined) return found.value as TokenGroup;
        errors.push({
            path: file,
            message: ErrorMessages.LOAD.POINTER_NOT_FOUND(file, pointer, found.error),
        });
        return undefined;
    };

    return (ref) => {
        const key = ref.pointer === undefined ? ref.file : `${ref.file}#${ref.pointer}`;
        if (!groups.has(key)) groups.set(key, groupOf(ref));
        return groups.get(key);
    };
}

function parse(file: string, text: string | undefined, errors: ComposeError[]): unknown {
    if (text === undefined) {
        errors.push({ path: file, message: ErrorMessages.LOAD.NO_SOURCE_TEXT(file) });
        return undefined;
    }
    try {
        return JSON.parse(text);
    } catch (cause) {
        errors.push({
            path: file,
            message: cause instanceof Error ? cause.message : String(cause),
        });
        return undefined;
    }
}
