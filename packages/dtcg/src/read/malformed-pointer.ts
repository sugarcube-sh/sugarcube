import type { DiagnosticDetailByKind } from "../model.js";
import type { Merged } from "./merge.js";
import { type PointerParseResult, parsePointerText } from "./pointer.js";
import { lookupPointer, toValuePointer } from "./ref-meaning.js";

type Malformed = DiagnosticDetailByKind["malformed-pointer"];

export function malformedPointer(
    ref: string,
    { problem, corrected }: Extract<PointerParseResult, { ok: false }>,
    resolves: boolean,
): Malformed {
    return { ref, reason: problem, ...(resolves && { corrected }) };
}

export function checkMalformedPointer(
    ref: string,
    merged: Merged,
    wanted: "value" | "group",
): Malformed | undefined {
    if (!ref.startsWith("#")) return undefined;
    const read = parsePointerText(ref);
    if (read.ok) return undefined;
    const reached = lookupPointer(read.correctedSteps, merged).kind;
    if (wanted === "group") return malformedPointer(ref, read, reached === "group");
    if (reached !== "stops-at-token") {
        return malformedPointer(ref, read, reached === "token" || reached === "part");
    }
    return malformedPointer(ref, { ...read, corrected: toValuePointer(read.corrected) }, true);
}
