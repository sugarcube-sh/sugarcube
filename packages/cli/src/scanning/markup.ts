import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import { CLIError } from "../types/index.js";
import { MARKUP_GLOB_PATTERN, MARKUP_IGNORE_PATTERNS } from "./constants.js";

// Safety limits to prevent OOM crashes
// Can't just search up etc because CLI has to work with the simplest possible setup
// e.g. no git repo, no package.json, no node_modules, no build tools etc.
const MAX_FILES = 10_000;
const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export async function getMarkupFiles(): Promise<string[]> {
    const files = await glob([MARKUP_GLOB_PATTERN], {
        ignore: MARKUP_IGNORE_PATTERNS,
        dot: false,
        onlyFiles: true,
        absolute: false,
    });

    if (files.length > MAX_FILES) {
        throw new CLIError(
            `Found ${files.length} files to scan (limit: ${MAX_FILES}). Are you running this from a monorepo root or a directory containing multiple projects? Run the command from within a single project directory instead.`
        );
    }

    return files;
}

export async function readMarkupSources(files: string[]): Promise<string[]> {
    const sources: string[] = [];
    let totalSize = 0;

    for (const file of files) {
        const content = await readFile(file, "utf8");
        totalSize += content.length;

        if (totalSize > MAX_SIZE_BYTES) {
            throw new CLIError(
                `Total source size exceeds ${MAX_SIZE_MB}MB. Are you running this from a monorepo root or a directory containing multiple projects? Run the command from within a single project directory instead.`
            );
        }

        sources.push(content);
    }

    return sources;
}
