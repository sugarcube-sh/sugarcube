import { relative } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import type { LoadError, TokenMemoryData } from "../types/load.js";
import type { TokenTree } from "../types/tokens.js";

export type LoadResult = {
    trees: TokenTree[];
    errors: LoadError[];
};

/** Loads tokens from in-memory data (for CLI/testing). */
export async function loadTreesFromMemory(data: TokenMemoryData): Promise<LoadResult> {
    const trees: TokenTree[] = [];
    const errors: LoadError[] = [];

    const entries = Object.entries(data);

    // Need to ensure that base tokens come first!
    entries.sort(([, a], [, b]) => {
        const aIsBase = !a.context;
        const bIsBase = !b.context;
        if (aIsBase && !bIsBase) return -1;
        if (!aIsBase && bIsBase) return 1;
        return 0;
    });

    for (const [path, { context, content }] of entries) {
        try {
            const tokens = JSON.parse(content);
            trees.push({
                context,
                tokens,
                sourcePath: relative(process.cwd(), path),
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error instanceof SyntaxError) {
                    errors.push({
                        file: path,
                        message: ErrorMessages.LOAD.INVALID_JSON(path, error.message),
                    });
                } else {
                    errors.push({
                        file: path,
                        message: error.message,
                    });
                }
            } else {
                errors.push({
                    file: path,
                    message: "Unknown error",
                });
            }
        }
    }

    return { trees, errors };
}
