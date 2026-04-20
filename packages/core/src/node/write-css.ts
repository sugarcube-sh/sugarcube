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
export async function writeCSSVariablesToDisk(output: CSSFileOutput): Promise<CSSFileOutput> {
    for (const file of output) {
        try {
            await mkdir(dirname(file.path), { recursive: true });
            await writeFile(file.path, file.css, "utf-8");
        } catch (error) {
            throw new Error(
                `Failed to write CSS file ${file.path}: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    return output;
}

/**
 * Writes utility CSS files to disk, creating directories as needed.
 *
 * @param output - The CSS file output to write
 * @returns The CSS file output that was written
 * @throws Error if file writing fails
 */
export async function writeCSSUtilitiesToDisk(output: CSSFileOutput): Promise<CSSFileOutput> {
    for (const file of output) {
        try {
            await mkdir(dirname(file.path), { recursive: true });
            await writeFile(file.path, file.css, "utf-8");
        } catch (error) {
            throw new Error(
                `Failed to write utility CSS file ${file.path}: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    return output;
}
