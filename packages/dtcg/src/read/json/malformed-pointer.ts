import type { DiagnosticDetailByKind } from "../../model.js";
import type { Merged } from "../merge/merge.js";
import { type PointerParseResult, parsePointerText } from "./pointer.js";
import { lookupPointer, toValuePointer } from "../merge/target.js";

type Malformed = DiagnosticDetailByKind["malformed-pointer"];

export function malformedPointer(
    ref: string,
    { problem, corrected }: Extract<PointerParseResult, { ok: false }>,
    resolves: boolean,
): Malformed {
    return { ref, reason: problem, ...(resolves && { suggestion: corrected }) };
}

export function checkMalformedPointer(
    ref: string,
    merged: Merged,
    wanted: "value" | "group",
): Malformed | undefined {
    if (!ref.startsWith("#")) return undefined;
    const read = parsePointerText(ref);
    if (read.ok) return undefined;
    const targetKind = lookupPointer(read.correctedSteps, merged).kind;
    if (wanted === "group") return malformedPointer(ref, read, targetKind === "group");
    if (targetKind !== "stops-at-token") {
        return malformedPointer(ref, read, targetKind === "token" || targetKind === "part");
    }
    return malformedPointer(ref, { ...read, corrected: toValuePointer(read.corrected) }, true);
}
