import { type DesignTokens, type JsonPath, forbiddenInName } from "@sugarcube-sh/dtcg";
import { editedText } from "./apply.js";
import type { Clash, ClashPart, EditStep, FileOp } from "./index.js";
import { valueAt } from "./text-edits.js";

export function clashesOf(
    skipped: readonly EditStep[],
    theirs: DesignTokens,
    mine: DesignTokens,
    madeOn: readonly DesignTokens[] = [],
): Clash[] {
    if (skipped.length === 0) return [];
    const files = new Set(skipped.flatMap((step) => step.ops.map((op) => op.file)));
    const named = pathsByMember([mine, theirs, ...madeOn], files);
    return skipped.map((step) => {
        const parts = partsOf(step, theirs, mine, named);
        return { step, parts, keepable: !parts.some(isGone) };
    });
}

function partsOf(
    step: EditStep,
    theirs: DesignTokens,
    mine: DesignTokens,
    named: ReadonlyMap<string, string>,
): ClashPart[] {
    const byMember = new Map<string, { file: string; jsonPath: JsonPath; ops: FileOp[] }>();
    for (const op of step.ops) {
        const jsonPath = editedMember(op);
        const key = memberKey(op.file, jsonPath);
        const found = byMember.get(key) ?? { file: op.file, jsonPath, ops: [] };
        found.ops.push(op);
        byMember.set(key, found);
    }
    return [...byMember].map(([key, { file, jsonPath, ops }]) => {
        const forced = ops.reduce(force, mine.text(file) ?? "{}");
        const part: Writable<ClashPart> = { file, jsonPath };
        const path = named.get(key);
        if (path !== undefined) part.path = path;
        const yours = forced === undefined ? undefined : valueAt(forced, jsonPath);
        const now = theirs.jsonAt(file, jsonPath);
        if (yours !== undefined) part.yours = yours;
        if (now !== undefined) part.theirs = now;
        return part;
    });
}

export function isGone(part: ClashPart): boolean {
    return part.theirs === undefined;
}

type Writable<T> = { -readonly [K in keyof T]: T[K] };

function editedMember(op: FileOp): JsonPath {
    if (!("jsonPath" in op)) return [];
    const end = op.jsonPath.findIndex(
        (step) => typeof step === "string" && forbiddenInName(step) === "$",
    );
    return end === -1 ? op.jsonPath : op.jsonPath.slice(0, end);
}

function force(text: string | undefined, op: FileOp): string | undefined {
    if (text === undefined || op.kind === "deleteFile") return undefined;
    if (op.kind === "createFile") return JSON.stringify(op.value);
    return editedText(text, op) ?? text;
}

function pathsByMember(versions: DesignTokens[], files: Set<string>): Map<string, string> {
    const named = new Map<string, string>();
    for (const tokens of versions) {
        for (const path of [...tokens.tokenPaths(), ...tokens.groupPaths()]) {
            for (const { span, jsonPath } of tokens.writtenAt(path)) {
                if (!files.has(span.file)) continue;
                const key = memberKey(span.file, jsonPath);
                if (!named.has(key)) named.set(key, path);
            }
        }
    }
    return named;
}

function memberKey(file: string, jsonPath: JsonPath): string {
    return JSON.stringify([file, jsonPath]);
}
