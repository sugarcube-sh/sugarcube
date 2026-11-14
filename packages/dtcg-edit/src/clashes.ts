import { type DesignTokens, type JsonPath, tokenPath } from "@sugarcube-sh/dtcg";
import { applyOpToText } from "./apply.js";
import type { Clash, ClashPart, EditStep, FileOp } from "./index.js";
import { getValueAt } from "./text-edits.js";
import { getJsonAt } from "@sugarcube-sh/dtcg/editor";

export function findClashes(
    skipped: readonly EditStep[],
    theirs: DesignTokens,
    mine: DesignTokens,
    earlierVersions: readonly DesignTokens[] = [],
): Clash[] {
    if (skipped.length === 0) return [];
    const files = new Set(skipped.flatMap((step) => step.ops.map((op) => op.file)));
    const pathByMember = getPathByMember([mine, theirs, ...earlierVersions], files);
    return skipped.map((step) => {
        const parts = getClashParts(step, theirs, mine, pathByMember);
        return { step, parts, canKeepYours: !parts.some(isGone) };
    });
}

function getClashParts(
    step: EditStep,
    theirs: DesignTokens,
    mine: DesignTokens,
    pathByMember: ReadonlyMap<string, string>,
): ClashPart[] {
    const opsByMember = new Map<string, { file: string; jsonPath: JsonPath; ops: FileOp[] }>();
    for (const op of step.ops) {
        const jsonPath = getMemberPath(op);
        const key = toMemberKey(op.file, jsonPath);
        const entry = opsByMember.get(key) ?? { file: op.file, jsonPath, ops: [] };
        entry.ops.push(op);
        opsByMember.set(key, entry);
    }
    return [...opsByMember].map(([key, { file, jsonPath, ops }]) => {
        const yourText = ops.reduce(applyYours, mine.getText(file) ?? "{}");
        const part: Mutable<ClashPart> = { file, jsonPath };
        const path = pathByMember.get(key);
        if (path !== undefined) part.path = path;
        const yours = yourText === undefined ? undefined : getValueAt(yourText, jsonPath);
        const theirValue = getJsonAt(theirs, file, jsonPath);
        if (yours !== undefined) part.yours = yours;
        if (theirValue !== undefined) part.theirs = theirValue;
        return part;
    });
}

export function isGone(part: ClashPart): boolean {
    return part.theirs === undefined;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function getMemberPath(op: FileOp): JsonPath {
    if (!("jsonPath" in op)) return [];
    const end = op.jsonPath.findIndex(
        (step) => typeof step === "string" && tokenPath.findInvalidCharacter(step) === "$",
    );
    return end === -1 ? op.jsonPath : op.jsonPath.slice(0, end);
}

function applyYours(text: string | undefined, op: FileOp): string | undefined {
    if (text === undefined || op.kind === "delete-file") return undefined;
    if (op.kind === "create-file") return JSON.stringify(op.value);
    return applyOpToText(text, op) ?? text;
}

function getPathByMember(versions: DesignTokens[], files: Set<string>): Map<string, string> {
    const pathByMember = new Map<string, string>();
    for (const tokens of versions) {
        for (const path of [...tokens.getTokenPaths(), ...tokens.getGroupPaths()]) {
            for (const { span, jsonPath } of tokens.getDefinitions(path)) {
                if (!files.has(span.file)) continue;
                const key = toMemberKey(span.file, jsonPath);
                if (!pathByMember.has(key)) pathByMember.set(key, path);
            }
        }
    }
    return pathByMember;
}

function toMemberKey(file: string, jsonPath: JsonPath): string {
    return JSON.stringify([file, jsonPath]);
}
