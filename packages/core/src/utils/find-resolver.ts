import { relative } from "pathe";
import { glob } from "tinyglobby";

export type ResolverDiscoveryResult =
    | { found: "one"; path: string }
    | { found: "multiple"; paths: string[] }
    | { found: "none" };

/**
 * Auto-discover *.resolver.json files anywhere in the project.
 * Searches recursively from the given directory, excluding build/dependency folders.
 *
 * @param directory - The directory to search from (typically process.cwd())
 * @returns Discovery result indicating if one, multiple, or no resolvers were found
 */
export async function findResolverDocument(directory: string): Promise<ResolverDiscoveryResult> {
    const pattern = "**/*.resolver.json";
    const files = await glob([pattern], {
        cwd: directory,
        onlyFiles: true,
        absolute: true,
        ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/out/**",
            "**/.git/**",
            "**/.next/**",
            "**/.nuxt/**",
            "**/.astro/**",
            "**/.cache/**",
            "**/.turbo/**",
            "**/.vercel/**",
            "**/.svelte-kit/**",
        ],
    });

    if (files.length === 0) {
        return { found: "none" };
    }

    const [firstFile] = files;
    if (files.length === 1 && firstFile) {
        return {
            found: "one",
            path: relative(process.cwd(), firstFile),
        };
    }

    return {
        found: "multiple",
        paths: files.map((f) => relative(process.cwd(), f)),
    };
}
