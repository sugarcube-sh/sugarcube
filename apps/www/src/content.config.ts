import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

const blog = defineCollection({
    loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        publishDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        ogImage: z.string().optional(),
        draft: z.boolean().default(false),
    }),
});

export const collections = {
    docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
    blog,
};
