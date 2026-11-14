import { type JsonPath, type JsonValue, isEqualJson } from "@sugarcube-sh/dtcg";
import type { EditStep, FileOp } from "./index.js";

type ValueOp = Extract<FileOp, { kind: "set" | "add" | "remove" }>;

export function mergeSteps(last: EditStep, next: EditStep): EditStep {
    let ops = [...last.ops];
    for (const op of next.ops) ops = addOp(ops, op);
    return { ops, moves: [...last.moves, ...next.moves] };
}

function addOp(ops: FileOp[], op: FileOp): FileOp[] {
    if (!isValueOp(op)) return [...ops, op];
    const index = findLastOverlapping(ops, op);
    const earlier = ops[index];
    if (!earlier || !isValueOp(earlier) || !samePath(earlier.jsonPath, op.jsonPath)) {
        return [...ops, op];
    }
    const folded = foldOps(earlier, op);
    return folded
        ? ops.map((each, at) => (at === index ? folded : each))
        : ops.filter((_, at) => at !== index);
}

function foldOps(earlier: ValueOp, later: ValueOp): ValueOp | undefined {
    const { file, jsonPath } = earlier;
    const was: JsonValue | undefined = earlier.kind === "add" ? undefined : earlier.was;
    if (later.kind === "remove") {
        return was === undefined ? undefined : { kind: "remove", file, jsonPath, was };
    }
    const { value } = later;
    if (was === undefined) return { kind: "add", file, jsonPath, value };
    return isEqualJson(was, value) ? undefined : { kind: "set", file, jsonPath, value, was };
}

function findLastOverlapping(ops: readonly FileOp[], op: ValueOp): number {
    return ops.findLastIndex((each) => overlaps(each, op));
}

function isValueOp(op: FileOp): op is ValueOp {
    return op.kind === "set" || op.kind === "add" || op.kind === "remove";
}

function overlaps(op: FileOp, other: ValueOp): boolean {
    if (op.file !== other.file) return false;
    if (!("jsonPath" in op)) return true;
    const shorter = Math.min(op.jsonPath.length, other.jsonPath.length);
    return samePath(op.jsonPath.slice(0, shorter), other.jsonPath.slice(0, shorter));
}

function samePath(one: JsonPath, other: JsonPath): boolean {
    return one.length === other.length && one.every((step, at) => step === other[at]);
}
