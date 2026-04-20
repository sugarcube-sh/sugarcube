import { z } from "zod";

/**
 * Name schema for sets, modifiers, and contexts.
 * Names MUST NOT:
 * - Start with '$' (reserved prefix per DTCG spec)
 * - Contain '{' or '}' (used in reference syntax)
 * - Contain '.' (used as path separator in references)
 */
const nameSchema = z
    .string()
    .min(1, "Name cannot be empty")
    .refine((name) => !name.startsWith("$"), "Names must not start with '$' (reserved prefix)")
    .refine((name) => !name.includes("{"), "Names must not contain '{'")
    .refine((name) => !name.includes("}"), "Names must not contain '}'")
    .refine((name) => !name.includes("."), "Names must not contain '.'");

/**
 * Reference object schema.
 * The $ref property uses JSON Pointer syntax for same-document references
 * or file paths for external references.
 */
const referenceObjectSchema = z
    .object({
        $ref: z.string().min(1, "$ref cannot be empty"),
    })
    .passthrough();

/**
 * Source schema - either a reference or inline token group.
 * We use z.unknown() for inline tokens since we don't need to validate
 * token structure at the resolver level.
 */
const sourceSchema = z.union([referenceObjectSchema, z.record(z.string(), z.unknown())]);

/**
 * Set definition schema for root-level sets map.
 */
const setDefinitionSchema = z.object({
    description: z.string().optional(),
    sources: z.array(sourceSchema),
    $extensions: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Modifier contexts schema.
 * Each key is a context name, value is an array of sources.
 */
const modifierContextsSchema = z.record(z.string(), z.array(sourceSchema));

/**
 * Modifier definition schema for root-level modifiers map.
 */
const modifierDefinitionSchema = z
    .object({
        description: z.string().optional(),
        contexts: modifierContextsSchema,
        default: z.string().optional(),
        $extensions: z.record(z.string(), z.unknown()).optional(),
    })
    .refine(
        (mod) => Object.keys(mod.contexts).length >= 1,
        "Modifier must have at least 1 context"
    );

/**
 * Inline set schema for resolutionOrder.
 */
const inlineSetSchema = z.object({
    type: z.literal("set"),
    name: nameSchema,
    sources: z.array(sourceSchema),
    description: z.string().optional(),
    $extensions: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Inline modifier schema for resolutionOrder.
 */
const inlineModifierSchema = z
    .object({
        type: z.literal("modifier"),
        name: nameSchema,
        contexts: modifierContextsSchema,
        description: z.string().optional(),
        default: z.string().optional(),
        $extensions: z.record(z.string(), z.unknown()).optional(),
    })
    .refine(
        (mod) => Object.keys(mod.contexts).length >= 1,
        "Modifier must have at least 1 context"
    );

/**
 * Resolution order item schema.
 * Can be a reference, inline set, or inline modifier.
 */
const resolutionOrderItemSchema = z.union([
    referenceObjectSchema,
    inlineSetSchema,
    inlineModifierSchema,
]);

/**
 * Root-level sets map schema.
 */
const setsMapSchema = z.record(nameSchema, setDefinitionSchema);

/**
 * Root-level modifiers map schema.
 */
const modifiersMapSchema = z.record(nameSchema, modifierDefinitionSchema);

export const resolverDocumentSchema = z.object({
    version: z.literal("2025.10"),
    name: z.string().optional(),
    description: z.string().optional(),
    sets: setsMapSchema.optional(),
    modifiers: modifiersMapSchema.optional(),
    resolutionOrder: z.array(resolutionOrderItemSchema),
    $schema: z.string().optional(),
    $extensions: z.record(z.string(), z.unknown()).optional(),
    $defs: z.record(z.string(), z.unknown()).optional(),
});
