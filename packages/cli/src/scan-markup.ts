import { readFile } from "node:fs/promises";
import { extname } from "pathe";
import { glob } from "tinyglobby";
import { CLIError } from "./cli-error.js";
import { ErrorMessages } from "./constants/error-messages.js";
import {
    MARKUP_EXTENSIONS,
    MARKUP_GLOB_PATTERN,
    MARKUP_IGNORE_PATTERNS,
} from "./constants/markup.js";

export const MAX_MARKUP_FILES = 10_000;
const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function isMarkupFile(file: string): boolean {
    return MARKUP_EXTENSIONS.has(extname(file).slice(1).toLowerCase());
}

export async function getMarkupFiles(content?: readonly string[]): Promise<string[]> {
    const usingContent = content !== undefined && content.length > 0;

    const matched = await glob(usingContent ? content : [MARKUP_GLOB_PATTERN], {
        ignore: MARKUP_IGNORE_PATTERNS,
        dot: false,
        onlyFiles: true,
        absolute: usingContent,
        caseSensitiveMatch: false,
    });

    const files = usingContent ? matched.filter(isMarkupFile) : matched;

    if (files.length > MAX_MARKUP_FILES) {
        throw new CLIError(ErrorMessages.MARKUP_TOO_MANY_FILES(files.length, MAX_MARKUP_FILES));
    }

    return files.sort();
}

const READ_CONCURRENCY = 64;

export async function readMarkupSources(files: string[]): Promise<string[]> {
    const sources: string[] = [];
    let totalSize = 0;

    for (let start = 0; start < files.length; start += READ_CONCURRENCY) {
        const batch = files.slice(start, start + READ_CONCURRENCY);
        const contents = await Promise.all(batch.map((file) => readFile(file, "utf8")));

        for (const content of contents) {
            totalSize += content.length;

            if (totalSize > MAX_SIZE_BYTES) {
                throw new CLIError(ErrorMessages.MARKUP_TOO_LARGE(MAX_SIZE_MB));
            }

            sources.push(content);
        }
    }

    return sources;
}
