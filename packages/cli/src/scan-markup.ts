import { readFile } from "node:fs/promises";
import { extname } from "pathe";
import { glob } from "tinyglobby";
import { CLIError } from "./cli-error.js";
import {
    MARKUP_EXTENSIONS,
    MARKUP_GLOB_PATTERN,
    MARKUP_IGNORE_PATTERNS,
} from "./constants/markup.js";

// Safety limits to prevent OOM crashes
// Can't just search up etc because CLI has to work with the simplest possible setup
// e.g. no git repo, no package.json, no node_modules, no build tools etc.
const MAX_FILES = 10_000;
const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function isMarkupFile(file: string): boolean {
    return MARKUP_EXTENSIONS.has(extname(file).slice(1).toLowerCase());
}

export async function getMarkupFiles(content?: string[]): Promise<string[]> {
    const usingContent = content !== undefined && content.length > 0;

    const matched = await glob(usingContent ? content : [MARKUP_GLOB_PATTERN], {
        ignore: MARKUP_IGNORE_PATTERNS,
        dot: false,
        onlyFiles: true,
        absolute: usingContent,
        caseSensitiveMatch: false,
    });

    const files = usingContent ? matched.filter(isMarkupFile) : matched;

    if (files.length > MAX_FILES) {
        throw new CLIError(
            `Found ${files.length} files to scan (limit: ${MAX_FILES}). Are you running this from a monorepo root or a directory containing multiple projects? Run the command from within a single project directory instead.`,
        );
    }

    return files;
}

// Read this many files at once. Bounds open file descriptors and memory while
// still overlapping I/O, which dominates markup scanning on large projects.
const READ_CONCURRENCY = 64;

export async function readMarkupSources(files: string[]): Promise<string[]> {
    const sources: string[] = [];
    let totalSize = 0;

    // Read in bounded batches. Batches are awaited in order and Promise.all keeps
    // within-batch order, so pushing preserves the original file order. Size is
    // checked as each batch lands so an oversized project still aborts early-ish.
    for (let start = 0; start < files.length; start += READ_CONCURRENCY) {
        const batch = files.slice(start, start + READ_CONCURRENCY);
        const contents = await Promise.all(batch.map((file) => readFile(file, "utf8")));

        for (const content of contents) {
            totalSize += content.length;

            if (totalSize > MAX_SIZE_BYTES) {
                throw new CLIError(
                    `Total source size exceeds ${MAX_SIZE_MB}MB. Are you running this from a monorepo root or a directory containing multiple projects? Run the command from within a single project directory instead.`,
                );
            }

            sources.push(content);
        }
    }

    return sources;
}
