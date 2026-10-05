import { fixTitles } from "../error-messages.js";
import type { DiagnosticDetailByKind, Fix, Span } from "../index.js";
import type { Merged } from "./merge.js";
import { parsePointer, readPointerText } from "./pointer.js";
import { reach } from "./ref-meaning.js";

export function malformation(
    written: string,
    pointerAt: Span,
    merged: Merged,
): { detail: DiagnosticDetailByKind["malformed-pointer"]; fixes?: Fix[] } | undefined {
    if (!written.startsWith("#")) return undefined;
    const read = readPointerText(written);
    if (read.ok) return undefined;
    const detail = { ref: written, reason: read.problem, corrected: read.corrected };
    if (reach(parsePointer(read.corrected), merged).kind === "nothing") return { detail };
    const { file, offset, length } = pointerAt;
    const edits = [{ file, offset, length, text: JSON.stringify(read.corrected) }];
    return {
        detail,
        fixes: [{ title: fixTitles.writePointer(read.corrected), safe: true, edits }],
    };
}
