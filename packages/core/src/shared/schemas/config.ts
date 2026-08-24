import { z } from "zod";
import { ErrorMessages } from "../constants/error-messages.js";
import { panelSourceIssue, resolvePanelDefaults } from "../panel.js";

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
    propagateDependents: z.boolean().optional(),
});

const utilitiesOutputConfigSchema = z.object({
    path: z.string().optional(),
    layer: z.string().optional(),
    classes: utilityClassesSchema.optional(),
});

const panelSourceSchema = z.enum(["colorScale"]);

const aliasOptionsSchema = z.union([z.string().min(1), z.record(z.string(), z.string())]);

const aliasBindingSchema = z.object({
    type: z.literal("alias"),
    token: z.string().min(1, "Token path cannot be empty"),
    from: panelSourceSchema.optional(),
    options: aliasOptionsSchema.optional(),
    label: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    only: z.array(z.string().min(1, "Segment name cannot be empty")).min(1).optional(),
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

const linkBindingSchema = z.object({
    type: z.literal("link"),
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
    aliasBindingSchema,
    scaleBindingSchema,
    linkBindingSchema,
    paletteSwapBindingSchema,
]);

const colorScaleConfigSchema = z.object({
    palettes: z
        .array(z.string().min(1, "Palette path cannot be empty"))
        .min(1, "Palettes array cannot be empty"),
    steps: z
        .array(z.string().min(1, "Step name cannot be empty"))
        .min(1, "Steps array cannot be empty")
        .optional(),
});

const panelSectionSchema = z
    .object({
        title: z.string().min(1, "Section title cannot be empty"),
        from: panelSourceSchema.optional(),
        options: aliasOptionsSchema.optional(),
        bindings: z.array(panelBindingSchema).min(1, "Bindings array cannot be empty"),
    })
    .superRefine((section, ctx) => {
        for (const [index, binding] of section.bindings.entries()) {
            if (binding.type !== "alias") continue;

            const issue = panelSourceIssue(resolvePanelDefaults(section, binding));
            if (!issue) continue;

            ctx.addIssue({
                code: "custom",
                path: ["bindings", index, issue === "ambiguous" ? "from" : "options"],
                message:
                    issue === "ambiguous"
                        ? ErrorMessages.CONFIG.PANEL_AMBIGUOUS_SOURCE(section.title, binding.token)
                        : ErrorMessages.CONFIG.PANEL_MISSING_SOURCE(section.title, binding.token),
            });
        }
    });

const studioConfigSchema = z.object({
    colorScale: colorScaleConfigSchema.optional(),
    panel: z.array(panelSectionSchema).optional(),
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
        variableName: variableNameFnSchema.optional(),
        layer: z.string().optional(),
        transforms: z.object({
            fluid: fluidSchema,
            colorFallbackStrategy: z.enum(["native", "polyfill"]),
        }),
        permutations: z.array(permutationSchema).optional(),
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
