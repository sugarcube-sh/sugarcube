import { dirname, isAbsolute, relative, resolve as resolvePath } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import { parseResolverDocument } from "../resolver/parse-resolver.js";
import { processResolutionOrder } from "../resolver/process-resolution-order.js";
import { type ExtractedModifier, extractModifiers } from "../resolver/utils.js";
import type { Permutation } from "../types/config.js";
import type { LoadError } from "../types/load.js";
import type { TokenTree } from "../types/tokens.js";

export type ResolverWarning = {
    path: string;
    message: string;
};

/**
 * Result of loading tokens from a resolver document.
 */
export type ResolverLoadResult = {
    /** Token trees for pipeline processing, keyed by "perm:{index}" */
    trees: TokenTree[];
    /** The permutations that were resolved (either from config or auto-generated) */
    permutations: Permutation[];
    /** Any errors encountered during loading */
    errors: LoadError[];
    /** Non-blocking warnings */
    warnings: ResolverWarning[];
};

/**
 * Validate permutation inputs against the resolver's modifiers.
 * Returns errors for unknown modifier names or invalid context values.
 */
function validatePermutationInputs(
    permutations: Permutation[],
    resolverModifiers: ExtractedModifier[]
): LoadError[] {
    const errors: LoadError[] = [];
    const modifierMap = new Map(resolverModifiers.map((m) => [m.name, m]));

    for (const perm of permutations) {
        for (const [modName, ctxValue] of Object.entries(perm.input)) {
            const modifier = modifierMap.get(modName);

            if (!modifier) {
                errors.push({
                    file: "sugarcube.config",
                    message: ErrorMessages.PERMUTATIONS.UNKNOWN_MODIFIER(
                        modName,
                        resolverModifiers.map((m) => m.name)
                    ),
                });
                continue;
            }

            if (!modifier.contexts.includes(ctxValue)) {
                errors.push({
                    file: "sugarcube.config",
                    message: ErrorMessages.PERMUTATIONS.UNKNOWN_CONTEXT(
                        modName,
                        ctxValue,
                        modifier.contexts
                    ),
                });
            }
        }
    }

    return errors;
}

/**
 * Generate default permutations from the resolver's modifiers.
 * - Default contexts (all defaults) → :root
 * - Each non-default context → [data-{modifierName}="{context}"]
 */
function generateDefaultPermutations(resolverModifiers: ExtractedModifier[]): Permutation[] {
    if (resolverModifiers.length === 0) {
        return [{ input: {}, selector: ":root" }];
    }

    const permutations: Permutation[] = [];

    const defaultInput: Record<string, string> = {};
    for (const mod of resolverModifiers) {
        defaultInput[mod.name] = mod.default ?? mod.contexts[0] ?? "";
    }
    permutations.push({ input: defaultInput, selector: ":root" });

    for (const mod of resolverModifiers) {
        const defaultCtx = mod.default ?? mod.contexts[0] ?? "";
        for (const ctx of mod.contexts) {
            if (ctx === defaultCtx) continue;

            const input: Record<string, string> = { ...defaultInput };
            input[mod.name] = ctx;
            permutations.push({
                input,
                selector: `[data-${mod.name}="${ctx}"]`,
            });
        }
    }

    return permutations;
}

/**
 * Resolve each permutation independently via processResolutionOrder.
 * Returns one token tree per permutation, keyed by "perm:{index}".
 */
async function resolvePermutations(
    document: Parameters<typeof processResolutionOrder>[0],
    basePath: string,
    relativePath: string,
    permutations: Permutation[],
    resolverModifiers: ExtractedModifier[],
    errors: LoadError[]
): Promise<TokenTree[]> {
    const trees: TokenTree[] = [];

    for (let i = 0; i < permutations.length; i++) {
        const perm = permutations[i];
        if (!perm) continue;

        // Build full input: permutation input + defaults for unspecified modifiers
        const fullInput: Record<string, string> = {};
        for (const mod of resolverModifiers) {
            fullInput[mod.name] = perm.input[mod.name] ?? mod.default ?? mod.contexts[0] ?? "";
        }

        const result = await processResolutionOrder(document, basePath, fullInput);

        for (const error of result.errors) {
            errors.push({ file: error.path, message: error.message });
        }

        if (Object.keys(result.tokens).length > 0) {
            trees.push({
                context: `perm:${i}`,
                tokens: result.tokens,
                sourcePath: relativePath,
            });
        }
    }

    return trees;
}

/**
 * Load tokens from a resolver document.
 *
 * Resolves each permutation independently via processResolutionOrder.
 * When no permutations are provided, auto-generates them from the resolver's modifiers.
 *
 * Returns TokenTree[] keyed by "perm:{index}".
 *
 * @param resolverPath - Path to the resolver document
 * @param permutations - Permutations to resolve. Auto-generated from modifiers if not provided.
 */
export async function loadFromResolver(
    resolverPath: string,
    permutations?: Permutation[]
): Promise<ResolverLoadResult> {
    const absolutePath = isAbsolute(resolverPath)
        ? resolverPath
        : resolvePath(process.cwd(), resolverPath);

    const basePath = dirname(absolutePath);
    const errors: LoadError[] = [];
    const relativePath = relative(process.cwd(), absolutePath);

    const parseResult = await parseResolverDocument(absolutePath);
    if (parseResult.errors.length > 0) {
        return {
            trees: [],
            permutations: [],
            errors: parseResult.errors.map((e) => ({
                file: e.path,
                message: e.message,
            })),
            warnings: [],
        };
    }

    const warnings: ResolverWarning[] = parseResult.warnings.map((w) => ({
        path: w.path,
        message: w.message,
    }));

    const resolverModifiers = extractModifiers(parseResult.document);

    // Use provided permutations or auto-generate from modifiers
    const resolvedPermutations =
        permutations && permutations.length > 0
            ? permutations
            : generateDefaultPermutations(resolverModifiers);

    // Validate all permutation inputs
    const validationErrors = validatePermutationInputs(resolvedPermutations, resolverModifiers);
    if (validationErrors.length > 0) {
        return { trees: [], permutations: [], errors: validationErrors, warnings };
    }

    // Resolve each permutation independently
    const trees = await resolvePermutations(
        parseResult.document,
        basePath,
        relativePath,
        resolvedPermutations,
        resolverModifiers,
        errors
    );

    return { trees, permutations: resolvedPermutations, errors, warnings };
}
