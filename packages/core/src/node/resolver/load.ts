import { dirname, isAbsolute, relative, resolve as resolvePath } from "pathe";
import { ErrorMessages } from "../../shared/constants/error-messages.js";
import type { Permutation } from "../../types/config.js";
import type { LoadError } from "../../types/load.js";
import type { ResolverDocument } from "../../types/resolver.js";
import type { TokenTree } from "../../types/tokens.js";
import { processResolutionOrder } from "./resolution-order.js";
import { type ExtractedModifier, extractModifiers } from "./utils.js";

export type ResolverLoadResult = {
    trees: TokenTree[];
    permutations: Permutation[];
    errors: LoadError[];
};

type PermutationResult = {
    trees: TokenTree[];
    errors: LoadError[];
};

// ============================================
// Helpers
// ============================================

function buildFullInput(
    permInput: Record<string, string>,
    modifiers: ExtractedModifier[]
): Record<string, string> {
    const full: Record<string, string> = {};
    for (const mod of modifiers) {
        full[mod.name] = permInput[mod.name] ?? mod.default ?? mod.contexts[0] ?? "";
    }
    return full;
}

function getDefaultContext(mod: ExtractedModifier): string {
    return mod.default ?? mod.contexts[0] ?? "";
}

// ============================================
// Main entry point
// ============================================

/**
 * Load tokens from a parsed resolver document.
 *
 * Resolves each permutation independently via processResolutionOrder.
 * When no permutations are provided, auto-generates them from the resolver's modifiers.
 */
export async function loadFromResolver(
    document: ResolverDocument,
    resolverPath: string,
    permutations?: Permutation[]
): Promise<ResolverLoadResult> {
    const absolutePath = isAbsolute(resolverPath)
        ? resolverPath
        : resolvePath(process.cwd(), resolverPath);

    const basePath = dirname(absolutePath);
    const relativePath = relative(process.cwd(), absolutePath);

    const modifiers = extractModifiers(document);

    const resolvedPermutations =
        permutations && permutations.length > 0
            ? permutations
            : generateDefaultPermutations(modifiers);

    const validationErrors = validatePermutationInputs(resolvedPermutations, modifiers);
    if (validationErrors.length > 0) {
        return { trees: [], permutations: [], errors: validationErrors };
    }

    const { trees, errors } = await resolvePermutations(
        document,
        basePath,
        relativePath,
        resolvedPermutations,
        modifiers
    );

    return { trees, permutations: resolvedPermutations, errors };
}

// ============================================
// Permutation generation
// ============================================

/**
 * Generate default permutations from the resolver's modifiers.
 * - Default contexts (all defaults) → :root
 * - Each non-default context → [data-{modifierName}="{context}"]
 */
function generateDefaultPermutations(modifiers: ExtractedModifier[]): Permutation[] {
    if (modifiers.length === 0) {
        return [{ input: {}, selector: ":root" }];
    }

    const defaultInput = buildFullInput({}, modifiers);
    const permutations: Permutation[] = [{ input: defaultInput, selector: ":root" }];

    for (const mod of modifiers) {
        const defaultCtx = getDefaultContext(mod);
        for (const ctx of mod.contexts) {
            if (ctx === defaultCtx) continue;

            permutations.push({
                input: { ...defaultInput, [mod.name]: ctx },
                selector: `[data-${mod.name}="${ctx}"]`,
            });
        }
    }

    return permutations;
}

// ============================================
// Validation
// ============================================

function validatePermutationInputs(
    permutations: Permutation[],
    modifiers: ExtractedModifier[]
): LoadError[] {
    const errors: LoadError[] = [];
    const modifierMap = new Map(modifiers.map((m) => [m.name, m]));

    for (const perm of permutations) {
        for (const [modName, ctxValue] of Object.entries(perm.input)) {
            const modifier = modifierMap.get(modName);

            if (!modifier) {
                errors.push({
                    file: "sugarcube.config",
                    message: ErrorMessages.PERMUTATIONS.UNKNOWN_MODIFIER(
                        modName,
                        modifiers.map((m) => m.name)
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

// ============================================
// Resolution
// ============================================

async function resolvePermutations(
    document: Parameters<typeof processResolutionOrder>[0],
    basePath: string,
    relativePath: string,
    permutations: Permutation[],
    modifiers: ExtractedModifier[]
): Promise<PermutationResult> {
    const trees: TokenTree[] = [];
    const errors: LoadError[] = [];

    for (let i = 0; i < permutations.length; i++) {
        const perm = permutations[i];
        if (!perm) continue;

        const fullInput = buildFullInput(perm.input, modifiers);
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

    return { trees, errors };
}
