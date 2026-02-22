import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve as resolvePath } from "pathe";
import { isInlineModifier, isInlineSet, isReference } from "../guards/resolver-guards.js";
import type { ResolverDocument, Source } from "../types/resolver.js";

/**
 * Result of extracting file references from a resolver document.
 */
export type ExtractFileRefsResult = {
    /** Absolute paths to all external token files referenced */
    filePaths: string[];
    /** Absolute path to the resolver file itself */
    resolverPath: string;
};

/**
 * Extract all external file paths from a resolver document without fully loading/resolving tokens.
 * This is useful for watch mode to know which files to monitor for changes without fully loading/resolving tokens.
 *
 * @param resolverPath - Path to the resolver JSON file
 * @returns Object containing absolute paths to all referenced files and the resolver itself
 */
export async function extractFileRefs(resolverPath: string): Promise<ExtractFileRefsResult> {
    const absoluteResolverPath = isAbsolute(resolverPath)
        ? resolverPath
        : resolvePath(process.cwd(), resolverPath);

    const basePath = dirname(absoluteResolverPath);

    const content = await readFile(absoluteResolverPath, "utf-8");
    const document = JSON.parse(content) as ResolverDocument;

    const filePaths = new Set<string>();

    for (const item of document.resolutionOrder) {
        if (isReference(item)) {
            addFileRef(item.$ref, basePath, filePaths);
        } else if (isInlineSet(item)) {
            extractFromSources(item.sources, basePath, filePaths);
        } else if (isInlineModifier(item)) {
            for (const sources of Object.values(item.contexts)) {
                extractFromSources(sources as Source[], basePath, filePaths);
            }
        }
    }

    if (document.sets) {
        for (const set of Object.values(document.sets)) {
            extractFromSources(set.sources, basePath, filePaths);
        }
    }

    if (document.modifiers) {
        for (const modifier of Object.values(document.modifiers)) {
            for (const sources of Object.values(modifier.contexts)) {
                extractFromSources(sources, basePath, filePaths);
            }
        }
    }

    return {
        filePaths: [...filePaths],
        resolverPath: absoluteResolverPath,
    };
}

/**
 * Extract file refs from a sources array.
 */
function extractFromSources(sources: Source[], basePath: string, filePaths: Set<string>): void {
    for (const source of sources) {
        if (isReference(source)) {
            addFileRef(source.$ref, basePath, filePaths);
        }
    }
}

/**
 * Add a file reference to the set if it's an external file (not a same-document reference).
 */
function addFileRef(ref: string, basePath: string, filePaths: Set<string>): void {
    // Skip same-document references like #/sets/base
    if (ref.startsWith("#/")) {
        return;
    }

    // Handle file references with or without fragments
    // e.g., "tokens/colors.json" or "tokens/colors.json#/colors"
    const filePart = ref.split("#")[0];
    if (!filePart) return;

    const absolutePath = isAbsolute(filePart) ? filePart : resolvePath(basePath, filePart);
    filePaths.add(absolutePath);
}
