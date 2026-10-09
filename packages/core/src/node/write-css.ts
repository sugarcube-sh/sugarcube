import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "pathe";
import type { CSSFileOutput } from "../types/generate.js";

/**
 * Writes CSS files to disk, creating directories as needed.
 *
 * @param output - Array of CSS file outputs to write
 * @returns The original output array
 * @throws Error if file writing fails
 */
export async function writeCSSFiles(output: CSSFileOutput): Promise<CSSFileOutput> {
    for (const file of output) {
        try {
            await mkdir(dirname(file.path), { recursive: true });
            await writeFile(file.path, file.css, "utf-8");
        } catch (error) {
            throw new Error(
                `Failed to write CSS file ${file.path}: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                { cause: error },
            );
        }
    }

    return output;
}
