import type { DiagnosticDetailByKind } from "../model.js";
import type { Merged } from "./merge.js";
import { type PointerReading, readPointerText } from "./pointer.js";
import { reach, toValuePointer } from "./ref-meaning.js";

type Malformed = DiagnosticDetailByKind["malformed-pointer"];

export function malformedPointer(
    ref: string,
    { problem, corrected }: Extract<PointerReading, { ok: false }>,
    reaches: boolean,
): Malformed {
    return { ref, reason: problem, ...(reaches && { corrected }) };
}

export function malformation(
    ref: string,
    merged: Merged,
    wanted: "value" | "group",
): Malformed | undefined {
    if (!ref.startsWith("#")) return undefined;
    const read = readPointerText(ref);
    if (read.ok) return undefined;
    const reached = reach(read.correctedSteps, merged).kind;
    if (wanted === "group") return malformedPointer(ref, read, reached === "group");
    if (reached !== "stops-at-token") {
        return malformedPointer(ref, read, reached === "token" || reached === "part");
    }
    return malformedPointer(ref, { ...read, corrected: toValuePointer(read.corrected) }, true);
}
