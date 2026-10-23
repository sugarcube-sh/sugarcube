import { z } from "zod";
import { ErrorMessages } from "../constants/error-messages.js";

const fluidSchema = z.object({
    min: z.number(),
    max: z.number(),
});

const permutationSchema = z.object({
    input: z.record(z.string(), z.string()),
    selector: z.union([
        z.string().min(1, "Selector cannot be empty"),
        z
            .array(z.string().min(1, "Selector cannot be empty"))
            .min(1, "Selector array cannot be empty"),
    ]),
    atRule: z.string().optional(),
    path: z.string().optional(),
});

const utilityConfigSchema = z.object({
    source: z.string(),
    directions: z
        .union([
            z.enum(["top", "right", "bottom", "left", "x", "y", "full", "all"]),
            z.array(z.enum(["top", "right", "bottom", "left", "x", "y", "full", "all"])),
        ])
        .optional(),
    prefix: z.string().optional(),
    stripDuplicates: z.boolean().optional(),
    safelist: z.union([z.boolean(), z.array(z.string())]).optional(),
});

const utilityConfigOrArraySchema = z.union([utilityConfigSchema, z.array(utilityConfigSchema)]);

const utilityClassesSchema = z
    .record(z.string(), utilityConfigOrArraySchema)
    .superRefine((classes, ctx) => {
        for (const [property, listed] of Object.entries(classes)) {
            for (const [index, { source }] of [listed].flat().entries()) {
                const message =
                    source === ""
                        ? ErrorMessages.UTILITIES.EMPTY_SOURCE(property)
                        : source.includes("*") && !source.endsWith(".*")
                          ? ErrorMessages.UTILITIES.INVALID_SOURCE_PATTERN(property, source)
                          : undefined;
                if (message === undefined) continue;
                ctx.addIssue({
                    code: "custom",
                    path: Array.isArray(listed)
                        ? [property, index, "source"]
                        : [property, "source"],
                    message,
                });
            }
        }
    });

const transformsSchema = z.object({
    fluid: fluidSchema.optional(),
    colorFallbackStrategy: z.enum(["native", "polyfill"]).optional(),
});

// Zod's built-in z.function() wraps the callback with runtime arg validation,
// which would break reference identity — users pass their own function in and
// expect the same function back. We just verify it's callable and pass through.
const variableNameFnSchema = z.custom<(path: string) => string>((v) => typeof v === "function", {
    message: "variableName must be a function",
});

const variablesConfigSchema = z.object({
    path: z.string().optional(),
    prefix: z.string().optional(),
    case: z.enum(["kebab"]).optional(),
    delimiter: z.string().optional(),
    variableName: variableNameFnSchema.optional(),
    layer: z.string().optional(),
    transforms: transformsSchema.optional(),
    permutations: z.array(permutationSchema).optional(),
    redeclareDependents: z.boolean().optional(),
    propagateDependents: z.boolean().optional(),
});

const utilitiesOutputConfigSchema = z.object({
    path: z.string().optional(),
    layer: z.string().optional(),
    classes: utilityClassesSchema.optional(),
});

const studioConfigSchema = z.object({
    repository: z
        .string()
        .regex(/^[\w.-]+\/[\w.-]+$/, ErrorMessages.CONFIG.STUDIO_REPOSITORY)
        .optional(),
    branch: z.string().min(1).optional(),
    app: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]*$/, ErrorMessages.CONFIG.STUDIO_APP)
        .optional(),
    save: z.boolean().optional(),
    signIn: z
        .string()
        .regex(/^\/(?!\/)/, ErrorMessages.CONFIG.STUDIO_SIGN_IN)
        .optional(),
});

export const userConfigSchema = z.object({
    resolver: z.string().optional(),

    variables: variablesConfigSchema.optional(),

    utilities: utilitiesOutputConfigSchema.optional(),

    content: z.array(z.string()).optional(),

    components: z.string().optional(),

    cube: z.string().optional(),

    studio: studioConfigSchema.optional(),
});

export const internalConfigSchema = z.object({
    resolver: z.string().optional(),

    variables: z.object({
        path: z.string(),
        prefix: z.string().optional(),
        case: z.enum(["kebab"]).optional(),
        delimiter: z.string().optional(),
        variableName: variableNameFnSchema.optional(),
        layer: z.string().optional(),
        transforms: z.object({
            fluid: fluidSchema,
            colorFallbackStrategy: z.enum(["native", "polyfill"]),
        }),
        permutations: z.array(permutationSchema).optional(),
        redeclareDependents: z.boolean().optional(),
        propagateDependents: z.boolean().optional(),
    }),

    utilities: z.object({
        path: z.string(),
        layer: z.string().optional(),
        classes: utilityClassesSchema.optional(),
    }),

    content: z.array(z.string()).optional(),

    components: z.string().optional(),

    cube: z.string().optional(),

    studio: studioConfigSchema.optional(),
});
