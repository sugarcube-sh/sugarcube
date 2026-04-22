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

// Zod's built-in z.function() wraps the callback with runtime arg validation,
// which would break reference identity — users pass their own function in and
// expect the same function back. We just verify it's callable and pass through.
const variableNameFnSchema = z.custom<(path: string) => string>((v) => typeof v === "function", {
    message: "variableName must be a function",
});

const variablesConfigSchema = z.object({
    path: z.string().optional(),
    prefix: z.string().optional(),
    variableName: variableNameFnSchema.optional(),
    layer: z.string().optional(),
    transforms: transformsSchema.optional(),
    permutations: z.array(permutationSchema).optional(),
});

const utilitiesOutputConfigSchema = z.object({
    path: z.string().optional(),
    layer: z.string().optional(),
    classes: utilityClassesSchema.optional(),
});

const colorBindingSchema = z.object({
    type: z.literal("color"),
    token: z.string().min(1, "Token path cannot be empty"),
    label: z.string().optional(),
});

const presetBindingSchema = z.object({
    type: z.literal("preset"),
    token: z.string().min(1, "Token path cannot be empty"),
    options: z.union([z.string().min(1), z.record(z.string(), z.string())]),
    label: z.string().optional(),
});

const scaleBindingSchema = z.object({
    type: z.literal("scale"),
    token: z.string().min(1, "Token path cannot be empty"),
    label: z.string().optional(),
    base: z.string().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
});

const scaleLinkedBindingSchema = z.object({
    type: z.literal("scale-linked"),
    token: z.string().min(1, "Token path cannot be empty"),
    scalesWith: z.string().min(1, "scalesWith path cannot be empty"),
    label: z.string().optional(),
});

const paletteSwapBindingSchema = z.object({
    type: z.literal("palette-swap"),
    family: z.string().min(1, "Family path cannot be empty"),
    label: z.string().optional(),
    palettes: z
        .array(z.string().min(1, "Palette name cannot be empty"))
        .min(1, "Palettes array cannot be empty")
        .optional(),
});

const panelBindingSchema = z.discriminatedUnion("type", [
    colorBindingSchema,
    presetBindingSchema,
    scaleBindingSchema,
    scaleLinkedBindingSchema,
    paletteSwapBindingSchema,
]);

const colorScaleConfigSchema = z.object({
    // Empty string is valid — describes a project whose palettes live at
    // the token tree root (e.g. `blue.50` with no `color.` parent).
    prefix: z.string(),
    palettes: z
        .array(z.string().min(1, "Palette name cannot be empty"))
        .min(1, "Palettes array cannot be empty"),
    steps: z
        .array(z.string().min(1, "Step name cannot be empty"))
        .min(1, "Steps array cannot be empty"),
    white: z.string().min(1).optional(),
    black: z.string().min(1).optional(),
});

const panelSectionSchema = z.object({
    title: z.string().min(1, "Section title cannot be empty"),
    bindings: z.array(panelBindingSchema).min(1, "Bindings array cannot be empty"),
});

const studioConfigSchema = z.object({
    colorScale: colorScaleConfigSchema.optional(),
    panel: z.array(panelSectionSchema).optional(),
});

export const userConfigSchema = z.object({
    resolver: z.string().optional(),

    variables: variablesConfigSchema.optional(),

    utilities: utilitiesOutputConfigSchema.optional(),

    components: z.string().optional(),

    cube: z.string().optional(),

    studio: studioConfigSchema.optional(),
});

export const internalConfigSchema = z.object({
    resolver: z.string().optional(),

    variables: z.object({
        path: z.string(),
        prefix: z.string().optional(),
        variableName: variableNameFnSchema.optional(),
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

    studio: studioConfigSchema.optional(),
});
