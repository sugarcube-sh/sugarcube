import { relative } from "pathe";
import { ErrorMessages } from "../shared/constants/error-messages.js";
import type { LoadError, TokenMemoryData } from "../types/load.js";
import type { PipelineContext, TokenPipelineSource } from "../types/pipelines.js";
import { createPipelineContext } from "../types/pipelines.js";
import type { TokenTree } from "../types/tokens.js";
import { loadFromResolver } from "./resolver/load.js";
import { parseResolverDocument } from "./resolver/parse.js";

export type LoadResult = {
    /** The loaded token trees */
    trees: TokenTree[];
    /** Any errors that occurred during loading */
    errors: LoadError[];
};

/**
 * Node-only pipeline: `TokenPipelineSource` → loaded token trees.
 *
 * Reads tokens from disk (or in-memory data) and returns the raw trees, ready
 * to be fed into `resolveTokens`. Populates `source.config.variables.permutations`
 * with the resolver-derived permutations when using a resolver source.
 *
 * @param source - Where to read tokens from (memory or resolver path)
 * @param context - Optional pipeline context for warnings/events
 */
export async function loadTokens(
    source: TokenPipelineSource,
    context?: PipelineContext
): Promise<LoadResult> {
    const ctx = context ?? createPipelineContext();

    switch (source.type) {
        case "memory":
            return loadTreesFromMemory(source.data);

        case "resolver": {
            const parseResult = await parseResolverDocument(source.resolverPath);

            if (parseResult.errors.length > 0) {
                return {
                    trees: [],
                    errors: parseResult.errors.map((e) => ({ file: e.path, message: e.message })),
                };
            }

            for (const warning of parseResult.warnings) {
                ctx.warn(warning);
            }

            const result = await loadFromResolver(
                parseResult.document,
                source.resolverPath,
                source.config.variables.permutations
            );

            // Surface resolved permutations on the config so downstream stages
            // (CSS generation) can read them.
            source.config.variables.permutations = result.permutations;

            return { trees: result.trees, errors: result.errors };
        }
    }
}

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
