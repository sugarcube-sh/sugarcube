import type { DiagnosticDetailByKind } from "../index.js";
import type { Merged } from "./merge.js";
import { type PointerReading, parsePointer, readPointerText } from "./pointer.js";
import { reach } from "./ref-meaning.js";

type Malformed = DiagnosticDetailByKind["malformed-pointer"];

export function malformedPointer(
    ref: string,
    { problem, corrected }: Extract<PointerReading, { ok: false }>,
    reaches: boolean,
): Malformed {
    return { ref, reason: problem, ...(reaches && { corrected }) };
}

export function malformation(ref: string, merged: Merged): Malformed | undefined {
    if (!ref.startsWith("#")) return undefined;
    const read = readPointerText(ref);
    if (read.ok) return undefined;
    const reaches = reach(parsePointer(read.corrected), merged).kind !== "nothing";
    return malformedPointer(ref, read, reaches);
}
