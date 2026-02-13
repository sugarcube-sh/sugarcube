import { ErrorMessages } from "../constants/error-messages.js";
import type { BaseError } from "../types/errors.js";
import type { ResolverDocument, ResolverInputs } from "../types/resolver.js";
import { type ExtractedModifier, extractModifiers } from "./utils.js";

export type ValidationResult = {
    valid: boolean;
    errors: ValidationError[];
    resolvedInputs: ResolverInputs;
};

export type ValidationError = BaseError & {
    /** The modifier name that caused the error (if applicable) */
    modifier?: string;
};

/**
 * Validate inputs against a resolver document's modifiers.
 *
 * Per DTCG spec section 5:
 * - Input values MUST be strings
 * - If a modifier has no default and no input is provided, tools SHOULD throw an error
 */
export function validateInputs(
    document: ResolverDocument,
    inputs: Record<string, unknown> = {}
): ValidationResult {
    const errors: ValidationError[] = [];
    const resolvedInputs: ResolverInputs = {};
    const modifiers = extractModifiers(document);

    if (modifiers.length === 0) {
        validateNoModifiersCase(inputs, errors);
        return { valid: errors.length === 0, errors, resolvedInputs };
    }

    const modifierMap = new Map(modifiers.map((m) => [m.name, m]));

    validateProvidedInputs(inputs, modifierMap, errors, resolvedInputs);
    applyDefaults(modifiers, resolvedInputs, errors);

    return { valid: errors.length === 0, errors, resolvedInputs };
}

function validateNoModifiersCase(inputs: Record<string, unknown>, errors: ValidationError[]): void {
    for (const key of Object.keys(inputs)) {
        errors.push({
            modifier: key,
            message: ErrorMessages.RESOLVER.UNKNOWN_MODIFIER(key),
        });
    }
}

function validateProvidedInputs(
    inputs: Record<string, unknown>,
    modifierMap: Map<string, ExtractedModifier>,
    errors: ValidationError[],
    resolvedInputs: ResolverInputs
): void {
    for (const [name, value] of Object.entries(inputs)) {
        const modifier = modifierMap.get(name);

        if (!modifier) {
            errors.push({
                modifier: name,
                message: ErrorMessages.RESOLVER.UNKNOWN_MODIFIER(name),
            });
            continue;
        }

        if (typeof value !== "string") {
            errors.push({
                modifier: name,
                message: ErrorMessages.RESOLVER.INVALID_INPUT_TYPE(name),
            });
            continue;
        }

        if (!modifier.contexts.includes(value)) {
            errors.push({
                modifier: name,
                message: ErrorMessages.RESOLVER.INVALID_CONTEXT(value, name, modifier.contexts),
            });
            continue;
        }

        resolvedInputs[name] = value;
    }
}

function applyDefaults(
    modifiers: ExtractedModifier[],
    resolvedInputs: ResolverInputs,
    errors: ValidationError[]
): void {
    for (const modifier of modifiers) {
        if (resolvedInputs[modifier.name] !== undefined) continue;

        if (modifier.default !== undefined) {
            resolvedInputs[modifier.name] = modifier.default;
        } else {
            errors.push({
                modifier: modifier.name,
                message: ErrorMessages.RESOLVER.MISSING_REQUIRED_INPUT(modifier.name),
            });
        }
    }
}

export function getAvailableContexts(
    document: ResolverDocument
): Map<string, { contexts: string[]; default?: string }> {
    const modifiers = extractModifiers(document);
    const result = new Map<string, { contexts: string[]; default?: string }>();

    for (const modifier of modifiers) {
        result.set(modifier.name, {
            contexts: modifier.contexts,
            default: modifier.default,
        });
    }

    return result;
}

export function getDefaultInputs(document: ResolverDocument): ResolverInputs {
    const modifiers = extractModifiers(document);
    const inputs: ResolverInputs = {};

    for (const modifier of modifiers) {
        if (modifier.default === undefined) {
            throw new Error(ErrorMessages.RESOLVER.MISSING_REQUIRED_INPUT(modifier.name));
        }
        inputs[modifier.name] = modifier.default;
    }

    return inputs;
}

export function hasModifiers(document: ResolverDocument): boolean {
    return extractModifiers(document).length > 0;
}
