import type { TokenGroup } from "./dtcg.js";
import type { BaseError } from "./errors.js";

/**
 * A reference object using JSON Pointer syntax.
 * Can reference same-document locations or external files.
 *
 * Examples:
 * - Same-document: { "$ref": "#/sets/foundation" }
 * - External file: { "$ref": "tokens/colors.json" }
 * - File + fragment: { "$ref": "tokens/colors.json#/colors" }
 */
export type ReferenceObject = {
    $ref: string;
    /** Additional properties can extend the referenced content (shallow merge) */
    [key: string]: unknown;
};

/**
 * A source can be either inline tokens or a reference to external tokens.
 */
export type Source = ReferenceObject | TokenGroup;

/**
 * Definition of a set in the root-level `sets` map.
 */
export type SetDefinition = {
    description?: string;
    sources: Source[];
    $extensions?: Record<string, unknown>;
};

/**
 * Definition of a modifier in the root-level `modifiers` map.
 */
export type ModifierDefinition = {
    description?: string;
    /**
     * Map of context names to their sources.
     * MUST have at least 1 context.
     * SHOULD have 2+ contexts (1 context is equivalent to a set).
     */
    contexts: Record<string, Source[]>;
    /**
     * Which context to use if no input is provided for this modifier.
     * If not specified, an input is required.
     */
    default?: string;
    $extensions?: Record<string, unknown>;
};

/**
 * Inline set definition in resolutionOrder.
 */
export type InlineSet = {
    type: "set";
    name: string;
    sources: Source[];
    description?: string;
    $extensions?: Record<string, unknown>;
};

/**
 * Inline modifier definition in resolutionOrder.
 */
export type InlineModifier = {
    type: "modifier";
    name: string;
    contexts: Record<string, Source[]>;
    description?: string;
    default?: string;
    $extensions?: Record<string, unknown>;
};

/**
 * An item in the resolutionOrder array.
 * Can be a reference to a set/modifier, or an inline definition.
 */
export type ResolutionOrderItem = ReferenceObject | InlineSet | InlineModifier;

/**
 * The full resolver document structure.
 */
export type ResolverDocument = {
    /** Must be "2025.10" for this version of the spec */
    version: "2025.10";
    /** Optional human-readable name */
    name?: string;
    /** Optional description */
    description?: string;
    /** Root-level set definitions (can be referenced via $ref) */
    sets?: Record<string, SetDefinition>;
    /** Root-level modifier definitions (can be referenced via $ref) */
    modifiers?: Record<string, ModifierDefinition>;
    /** The ordered list of sets and modifiers to process */
    resolutionOrder: ResolutionOrderItem[];
    /** Optional JSON Schema reference */
    $schema?: string;
    /** Optional custom extensions */
    $extensions?: Record<string, unknown>;
    /** Optional definitions (behavior undefined per spec, but must not throw) */
    $defs?: Record<string, unknown>;
};

/**
 * An error that occurred during resolver parsing or processing.
 * Extends BaseError with path information for error location.
 */
export type ResolverError = BaseError & {
    /** JSON path or file path to the error location */
    path: string;
};

/**
 * Resolved content from a reference.
 */
type ResolvedReference = {
    /** The resolved content */
    content: TokenGroup | SetDefinition | ModifierDefinition | ResolverDocument;
    /** Path to the source (file path or "#" for same-document) */
    sourcePath: string;
    /** Type of source */
    sourceType: "document" | "file" | "remote";
};

/**
 * Result of processing the resolution order.
 */
type ResolutionResult = {
    /** The merged token structure */
    tokens: TokenGroup;
    /** Source information for debugging */
    sources: Array<{
        path: string;
        type: "set" | "modifier";
        name: string;
        context?: string;
    }>;
};

/**
 * Input values for modifier contexts.
 * Keys are modifier names, values are context names.
 *
 * Example: { "theme": "dark" }
 */
export type ResolverInputs = Record<string, string>;
