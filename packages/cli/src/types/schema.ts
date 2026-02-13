import { z } from "zod";
import type {
    BaseFile,
    ComponentFile,
    FileContentResponse,
    Framework,
    RegistryItem,
} from "./index.js";

const frameworkEnum = z.enum([
    "react",
    "web-components",
    "css-only",
] as const) satisfies z.ZodType<Framework>;

const baseFileSchema = z.object({
    path: z.string(),
    type: z.string(),
}) satisfies z.ZodType<BaseFile>;

const componentFileSchema = baseFileSchema.extend({
    framework: frameworkEnum,
}) satisfies z.ZodType<ComponentFile>;

const registryItemSchema = z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    frameworks: z.array(z.string()).optional(),
    files: z.array(z.union([componentFileSchema, baseFileSchema])),
    tokens: z
        .record(
            z.object({
                type: z.string(),
                mapping: z.string(),
            })
        )
        .optional(),
    dependencies: z.record(frameworkEnum, z.array(z.string())).optional(),
    registryDependencies: z.record(frameworkEnum, z.array(z.string())).optional(),
    tokenDependencies: z.array(z.string()).optional(),
}) satisfies z.ZodType<RegistryItem>;

export const registryIndexSchema = z.array(registryItemSchema);

export const fileContentResponseSchema = z.object({
    content: z.string(),
}) satisfies z.ZodType<FileContentResponse>;
