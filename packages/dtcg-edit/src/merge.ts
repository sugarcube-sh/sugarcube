import { type JsonPath, type JsonValue, sameJson } from "@sugarcube-sh/dtcg";
import type { EditStep, FileOp } from "./index.js";

type PlaceOp = Extract<FileOp, { kind: "set" | "add" | "remove" }>;

export function merged(last: EditStep, next: EditStep): EditStep {
    let ops = [...last.ops];
    for (const op of next.ops) ops = withOp(ops, op);
    return { ops, moved: [...last.moved, ...next.moved] };
}

function withOp(ops: FileOp[], op: FileOp): FileOp[] {
    if (!isPlaceOp(op)) return [...ops, op];
    const index = lastOverlapping(ops, op);
    const earlier = ops[index];
    if (!earlier || !isPlaceOp(earlier) || !samePath(earlier.jsonPath, op.jsonPath)) {
        return [...ops, op];
    }
    const folded = foldedOp(earlier, op);
    return folded
        ? ops.map((each, at) => (at === index ? folded : each))
        : ops.filter((_, at) => at !== index);
}

function foldedOp(earlier: PlaceOp, later: PlaceOp): PlaceOp | undefined {
    const { file, jsonPath } = earlier;
    const was: JsonValue | undefined = earlier.kind === "add" ? undefined : earlier.was;
    if (later.kind === "remove") {
        return was === undefined ? undefined : { kind: "remove", file, jsonPath, was };
    }
    const { value } = later;
    if (was === undefined) return { kind: "add", file, jsonPath, value };
    return sameJson(was, value) ? undefined : { kind: "set", file, jsonPath, value, was };
}

function lastOverlapping(ops: readonly FileOp[], op: PlaceOp): number {
    for (let at = ops.length - 1; at >= 0; at -= 1) {
        const each = ops[at];
        if (each && overlaps(each, op)) return at;
    }
    return -1;
}

function isPlaceOp(op: FileOp): op is PlaceOp {
    return op.kind === "set" || op.kind === "add" || op.kind === "remove";
}

function overlaps(op: FileOp, other: PlaceOp): boolean {
    if (op.file !== other.file) return false;
    if (!("jsonPath" in op)) return true;
    const shorter = Math.min(op.jsonPath.length, other.jsonPath.length);
    return samePath(op.jsonPath.slice(0, shorter), other.jsonPath.slice(0, shorter));
}

function samePath(one: JsonPath, other: JsonPath): boolean {
    return one.length === other.length && one.every((step, at) => step === other[at]);
}
