import { z } from "zod";

const fluidSchema = z.object({
    min: z.number(),
    max: z.number(),
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

export const userConfigSchema = z.object({
    resolver: z.string().optional(),

    transforms: z
        .object({
            fluid: fluidSchema.optional(),
            colorFallbackStrategy: z.enum(["native", "polyfill"]).optional(),
        })
        .optional(),

    output: z
        .object({
            cssRoot: z.string().optional(),
            variables: z.string().optional(),
            variablesFilename: z.string().optional(),
            utilities: z.string().optional(),
            utilitiesFilename: z.string().optional(),
            cube: z.string().optional(),
            components: z.string().optional(),
            themeAttribute: z.string().optional(),
            defaultContext: z.string().optional(),
        })
        .optional(),

    utilities: z.record(z.string(), utilityConfigOrArraySchema).optional(),
});

export const internalConfigSchema = z.object({
    resolver: z.string().optional(),

    transforms: z.object({
        fluid: fluidSchema,
        colorFallbackStrategy: z.enum(["native", "polyfill"]),
    }),

    output: z.object({
        cssRoot: z.string(),
        variables: z.string().optional(),
        variablesFilename: z.string(),
        utilities: z.string().optional(),
        utilitiesFilename: z.string(),
        cube: z.string().optional(),
        components: z.string().optional(),
        themeAttribute: z.string(),
        defaultContext: z.string().optional(),
    }),

    utilities: z.record(z.string(), utilityConfigOrArraySchema).optional(),
});
