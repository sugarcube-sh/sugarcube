import { fixTitles } from "../error-messages.js";
import type { DiagnosticDetailByKind, Fix, Span, TextEdit } from "../index.js";
import type { Merged } from "./merge.js";
import { type PointerReading, parsePointer, readPointerText } from "./pointer.js";
import { reach } from "./ref-meaning.js";

type Malformed = { detail: DiagnosticDetailByKind["malformed-pointer"]; fixes?: Fix[] };

export function malformedPointer(
    ref: string,
    { problem, corrected }: Extract<PointerReading, { ok: false }>,
    written: Omit<TextEdit, "text">,
    reaches: boolean,
): Malformed {
    if (!reaches) return { detail: { ref, reason: problem } };
    const detail = { ref, reason: problem, corrected };
    const edits = [{ ...written, text: JSON.stringify(corrected) }];
    return { detail, fixes: [{ title: fixTitles.writePointer(corrected), safe: true, edits }] };
}

export function malformation(ref: string, pointerAt: Span, merged: Merged): Malformed | undefined {
    if (!ref.startsWith("#")) return undefined;
    const read = readPointerText(ref);
    if (read.ok) return undefined;
    const { file, offset, length } = pointerAt;
    const reaches = reach(parsePointer(read.corrected), merged).kind !== "nothing";
    return malformedPointer(ref, read, { file, offset, length }, reaches);
}
