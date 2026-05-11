import { SUGARCUBE_NAMESPACE } from "@sugarcube-sh/core/client";
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
 * the studio submit API. Most entries are leaf-token changes (`$value`
 * and optionally a fluid extension). Group-level entries (e.g. an edited
 * scale extension on a parent group) have no `$value` — only the
 * relevant `$extensions` slot.
 */
export function diffToFileEdits(entries: readonly TokenDiffEntry[]): FileEdits[] {
    const byFile = new Map<string, TokenEdit[]>();

    for (const entry of entries) {
        const segments = entry.path.split(".");
        let edits = byFile.get(entry.sourcePath);
        if (!edits) {
            edits = [];
            byFile.set(entry.sourcePath, edits);
        }

        if (entry.to.$value !== undefined) {
            edits.push({ jsonPath: [...segments, "$value"], value: entry.to.$value });
        }

        const sugarcube = entry.to.$extensions?.[SUGARCUBE_NAMESPACE] as
            | Record<string, unknown>
            | undefined;
        if (sugarcube?.fluid) {
            edits.push({
                jsonPath: [...segments, "$extensions", SUGARCUBE_NAMESPACE, "fluid"],
                value: sugarcube.fluid,
            });
        }
        if (sugarcube?.scale) {
            edits.push({
                jsonPath: [...segments, "$extensions", SUGARCUBE_NAMESPACE, "scale"],
                value: sugarcube.scale,
            });
        }
    }

    return Array.from(byFile, ([path, edits]) => ({ path, edits }));
}
