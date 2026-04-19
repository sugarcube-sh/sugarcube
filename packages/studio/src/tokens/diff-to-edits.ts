import type { TokenDiffEntry } from "./types";

export type TokenEdit = {
    jsonPath: string[];
    value: unknown;
};

export type FileEdits = {
    path: string;
    edits: TokenEdit[];
};

/**
 * Convert a list of diff entries into the file-edit shape expected by
 * the studio submit API. Groups edits by source file and builds JSON
 * path segments for each changed property.
 */
export function diffToFileEdits(entries: TokenDiffEntry[]): FileEdits[] {
    const byFile = new Map<string, TokenEdit[]>();

    for (const entry of entries) {
        const segments = entry.path.split(".");
        let edits = byFile.get(entry.sourcePath);
        if (!edits) {
            edits = [];
            byFile.set(entry.sourcePath, edits);
        }

        edits.push({ jsonPath: [...segments, "$value"], value: entry.to.$value });

        const sugarcube = entry.to.$extensions?.["sh.sugarcube"] as
            | Record<string, unknown>
            | undefined;
        if (sugarcube?.fluid) {
            edits.push({
                jsonPath: [...segments, "$extensions", "sh.sugarcube", "fluid"],
                value: sugarcube.fluid,
            });
        }
    }

    return Array.from(byFile, ([path, edits]) => ({ path, edits }));
}
