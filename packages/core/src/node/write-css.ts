import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "pathe";
import { ErrorMessages } from "../shared/constants/error-messages.js";
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
            throw new Error(ErrorMessages.CSS_FILE_WRITE_FAILED(file.path, error), {
                cause: error,
            });
        }
    }

    return output;
}
