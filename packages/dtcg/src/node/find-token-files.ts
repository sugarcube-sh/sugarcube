import { readFile } from "node:fs/promises";
import { OTHER_SPEC_KEYS, OWN_PROPERTIES } from "../read/spec-keys.js";
import { findFiles, isJson } from "./find-files.js";

/**
 * What {@link findTokenFiles} found.
 *
 * Each list holds paths, in order.
 */
export interface FoundTokenFiles {
    /** The files that use a property from the spec, such as `$value` or `$type`. */
    readonly tokenFiles: readonly string[];
    /** The other JSON files it looked in, such as a `package.json`. */
    readonly otherFiles: readonly string[];
}

const JSON_SCHEMA_REF_KEY = "$ref";

const SPEC_PROPERTIES = [...OWN_PROPERTIES, ...OTHER_SPEC_KEYS]
    .filter((key) => key !== JSON_SCHEMA_REF_KEY)
    .map((key) => Buffer.from(JSON.stringify(key)));

/**
 * Finds the token files in files and folders.
 *
 * A file ending `.json` or `.tokens` is a token file if it uses a property from the spec, such as
 * `$value` or `$type`. The file doesn't have to parse. It skips the same folders as
 * {@link findResolver}.
 *
 * @param paths - The files and folders to search, such as `"."`.
 * @returns The token files, and the other JSON files it looked in.
 * @throws If a path doesn't exist.
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#file-extensions | Format 4.2, File extensions}
 *
 * @example
 * // A project folder with a package.json and two token files
 * await findTokenFiles(".")
 * // => { tokenFiles: ["tokens/color.json", "tokens/space.json"], otherFiles: ["package.json"] }
 */
export async function findTokenFiles(paths: string | readonly string[]): Promise<FoundTokenFiles> {
    const files = await findFiles(paths, (file) => isJson(file) || file.endsWith(".tokens"));
    const usesSpec = await Promise.all(
        files.map(async (file) => {
            const bytes = await readFile(file);
            return SPEC_PROPERTIES.some((property) => bytes.includes(property));
        }),
    );
    return {
        tokenFiles: files.filter((_, index) => usesSpec[index]),
        otherFiles: files.filter((_, index) => !usesSpec[index]),
    };
}
