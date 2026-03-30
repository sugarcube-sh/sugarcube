import { z } from "zod";

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
});

const utilityConfigOrArraySchema = z.union([utilityConfigSchema, z.array(utilityConfigSchema)]);

const utilityClassesSchema = z.record(z.string(), utilityConfigOrArraySchema);

const transformsSchema = z.object({
    fluid: fluidSchema.optional(),
    colorFallbackStrategy: z.enum(["native", "polyfill"]).optional(),
});

const variablesConfigSchema = z.object({
    path: z.string().optional(),
    layer: z.string().optional(),
    transforms: transformsSchema.optional(),
    permutations: z.array(permutationSchema).optional(),
});

const utilitiesOutputConfigSchema = z.object({
    path: z.string().optional(),
    layer: z.string().optional(),
    classes: utilityClassesSchema.optional(),
});

export const userConfigSchema = z.object({
    resolver: z.string().optional(),

    variables: variablesConfigSchema.optional(),

    utilities: utilitiesOutputConfigSchema.optional(),

    components: z.string().optional(),

    cube: z.string().optional(),
});

export const internalConfigSchema = z.object({
    resolver: z.string().optional(),

    variables: z.object({
        path: z.string(),
        layer: z.string().optional(),
        transforms: z.object({
            fluid: fluidSchema,
            colorFallbackStrategy: z.enum(["native", "polyfill"]),
        }),
        permutations: z.array(permutationSchema).optional(),
    }),

    utilities: z.object({
        path: z.string(),
        layer: z.string().optional(),
        classes: utilityClassesSchema.optional(),
    }),

    components: z.string().optional(),

    cube: z.string().optional(),
});
