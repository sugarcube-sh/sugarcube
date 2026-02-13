import { dirname, isAbsolute, relative, resolve as resolvePath } from "pathe";
import { parseResolverDocument } from "../resolver/parse-resolver.js";
import { processForLayeredCSS } from "../resolver/process-resolution-order.js";
import type { LoadError } from "../types/load.js";
import type { TokenTree } from "../types/tokens.js";

/**
 * Modifier metadata for CSS generation.
 * Used to build selectors like [data-theme="dark"].
 */
export type ModifierMeta = {
    /** The modifier name (e.g., "theme", "density") */
    name: string;
    /** Auto-derived CSS attribute (e.g., "data-theme", "data-density") */
    attribute: string;
    /** The default context name */
    defaultContext: string;
    /** Available non-default context names */
    contexts: string[];
};

/**
 * Result of loading tokens from a resolver document.
 */
export type ResolverLoadResult = {
    /** Token trees for pipeline processing (base + all modifier contexts) */
    trees: TokenTree[];
    /** Modifier metadata for CSS selector generation */
    modifiers: ModifierMeta[];
    /** Any errors encountered during loading */
    errors: LoadError[];
};

/**
 * Load tokens from a resolver document.
 *
 * Returns TokenTree[] with compound context keys for modifier contexts:
 * - Base tokens: context = undefined (maps to :root)
 * - Modifier contexts: context = "modifierName:contextName" (e.g., "theme:dark")
 */
export async function loadFromResolver(resolverPath: string): Promise<ResolverLoadResult> {
    const absolutePath = isAbsolute(resolverPath)
        ? resolverPath
        : resolvePath(process.cwd(), resolverPath);

    const basePath = dirname(absolutePath);
    const errors: LoadError[] = [];
    const trees: TokenTree[] = [];
    const relativePath = relative(process.cwd(), absolutePath);

    const parseResult = await parseResolverDocument(absolutePath);
    if (parseResult.errors.length > 0) {
        return {
            trees: [],
            modifiers: [],
            errors: parseResult.errors.map((e) => ({
                file: e.path,
                message: e.message,
            })),
        };
    }

    const result = await processForLayeredCSS(parseResult.document, basePath);

    // We really want resolver errors to be load errors, so I'll do that here
    for (const error of result.errors) {
        errors.push({
            file: error.path,
            message: error.message,
        });
    }

    if (Object.keys(result.base).length > 0) {
        trees.push({
            context: undefined, // REMEMBER: undefined = default = :root
            tokens: result.base,
            sourcePath: relativePath,
        });
    }

    const modifiers: ModifierMeta[] = [];
    for (const mod of result.modifiers) {
        const contextNames: string[] = [];

        for (const [contextName, tokens] of mod.contexts) {
            if (Object.keys(tokens).length > 0) {
                trees.push({
                    context: `${mod.name}:${contextName}`,
                    tokens,
                    sourcePath: relativePath,
                });
                contextNames.push(contextName);
            }
        }

        modifiers.push({
            name: mod.name,
            attribute: `data-${mod.name}`,
            defaultContext: mod.defaultContext,
            contexts: contextNames,
        });
    }

    return { trees, modifiers, errors };
}
