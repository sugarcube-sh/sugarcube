import { type DesignTokens, type JsonValue, isEqualJson } from "@sugarcube-sh/dtcg";
import { type Node, findNodeAtLocation, getNodeValue, parseTree } from "jsonc-parser";
import { createConflict } from "./error-messages.js";
import type {
    ApplyResult,
    ChangedFiles,
    CommitResult,
    Conflict,
    EditStep,
    Edits,
    FileOp,
    OperationResult,
} from "./index.js";
import {
    type Splice,
    detectIndentUnit,
    detectLineBreak,
    getRemovalSplices,
    applySplices,
} from "./json-text.js";
import { getRenameSplices, getSetSplices, getValueAt } from "./text-edits.js";

type MemberOp = Exclude<FileOp, { kind: "create-file" | "delete-file" }>;
type FileLevelOp = Extract<FileOp, { kind: "create-file" | "delete-file" }>;
type MemberOpResult = { conflict: Conflict["kind"] } | "stale" | undefined;
type TextByFile = Record<string, string | null>;

interface Draft {
    text: string;
    root?: Node | undefined;
    pending: Splice[];
}

interface FileTexts {
    get(file: string): string | undefined;
    set(file: string, text: string | null): void;
}

/**
 * Applies edits to the design tokens' text and reads them again.
 *
 * Other lines stay as written. If any edit no longer applies, none are made, and the conflicts
 * are returned.
 *
 * @param tokens - The design tokens to edit.
 * @param ops - The edits, such as an operation's `ops`.
 *
 * @example
 * // Set the shared color.primary to {color.blue.300}
 * const { ops } = setValue(tokens, "color.primary", "{color.blue.300}");
 * apply(tokens, ops!).tokens?.getDefinitions("color.primary")[0].json
 * // => { $type: "color", $value: "{color.blue.300}" }
 *
 * @example
 * // color.primary changed in color.json after the edit was made
 * apply(latest, ops!).conflicts?.map((conflict) => conflict.kind)
 * // => ["changed"]
 */
export function apply(tokens: DesignTokens, ops: readonly FileOp[]): ApplyResult {
    const changes = applyToTexts(tokens, ops);
    return changes.conflicts ? { conflicts: changes.conflicts } : { tokens: changes.tokens };
}

/**
 * Returns each file's new text after edits.
 *
 * Nothing is saved. Only a `delete-file` edit deletes a file, even when the resolver stops naming it.
 *
 * @param tokens - The design tokens the edits are for.
 * @param edits - The edits, such as {@link Session.unsavedEdits}.
 *
 * @example
 * // After setting the shared color.primary to {color.blue.300}
 * Object.keys(getChangedFiles(tokens, session.unsavedEdits).textByFile ?? {})
 * // => ["color.json"]
 */
export function getChangedFiles(tokens: DesignTokens, edits: Edits): ChangedFiles {
    return applyToTexts(
        tokens,
        edits.steps.flatMap((step) => step.ops),
    );
}

function applyToTexts(tokens: DesignTokens, ops: readonly FileOp[]): ChangedFiles {
    const { changed, conflicts } = editTexts(tokens, [{ ops, moves: [] }]);
    if (conflicts.length > 0) return { conflicts };
    const next = tokens.reread(changed);
    const unreadOps = findUnreadCreates(next, ops);
    if (unreadOps.length > 0)
        return { conflicts: unreadOps.map((op) => createConflict(op, "not-read")) };

    const written = Object.entries(changed)
        .flatMap(([file, text]): [string, string][] =>
            text !== null && text !== tokens.getText(file) ? [[file, text]] : [],
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const deleted = Object.keys(changed).filter((file) => changed[file] === null);
    return { tokens: next, textByFile: Object.fromEntries(written), deleted: deleted.sort() };
}

export function applyStepsThatFit(
    tokens: DesignTokens,
    steps: readonly EditStep[],
): { tokens: DesignTokens; applied: readonly EditStep[]; skipped: readonly EditStep[] } {
    let stepsToTry = steps;
    for (;;) {
        const { changed, fitting } = editTexts(tokens, stepsToTry);
        const next = fitting.length === 0 ? tokens : tokens.reread(changed);
        const unreadSteps = fitting.filter((step) => findUnreadCreates(next, step.ops).length > 0);
        if (unreadSteps.length === 0) {
            const fittingSet = new Set(fitting);
            const skipped = steps.filter((step) => !fittingSet.has(step));
            return { tokens: next, applied: fitting, skipped };
        }
        stepsToTry = fitting.filter((step) => !unreadSteps.includes(step));
    }
}

function editTexts(tokens: DesignTokens, steps: readonly EditStep[]) {
    let changed: TextByFile = {};
    const texts: FileTexts = {
        get: (file) => (file in changed ? (changed[file] ?? undefined) : tokens.getText(file)),
        set: (file, text) => {
            changed[file] = text;
        },
    };
    let drafts = new Map<string, Draft>();
    const styleText = texts.get(tokens.entryFile) ?? "";
    const flushDraft = (file: string) => {
        const draft = drafts.get(file);
        if (draft && draft.pending.length > 0)
            texts.set(file, applySplices(draft.text, draft.pending));
        drafts.delete(file);
    };
    const getDraft = (file: string) => {
        const text = texts.get(file);
        const draft = drafts.get(file) ?? (text === undefined ? undefined : { text, pending: [] });
        if (draft) drafts.set(file, draft);
        return draft;
    };
    const conflicts: Conflict[] = [];
    const fittingSteps: EditStep[] = [];
    for (const step of steps) {
        const before = { changed: { ...changed }, drafts: new Map(drafts) };
        const pendingBefore = new Map(
            [...drafts].map(([file, draft]) => [file, draft.pending.length]),
        );
        const stepConflicts: Conflict[] = [];
        for (const op of step.ops) {
            const kind = applyOp(op, styleText, texts, { getDraft, flushDraft });
            if (kind !== undefined) stepConflicts.push(createConflict(op, kind));
        }
        if (stepConflicts.length === 0) {
            fittingSteps.push(step);
            continue;
        }
        conflicts.push(...stepConflicts);
        changed = before.changed;
        drafts = before.drafts;
        for (const [file, draft] of drafts) draft.pending.length = pendingBefore.get(file) ?? 0;
    }
    for (const file of drafts.keys()) flushDraft(file);
    return { changed, conflicts, fitting: fittingSteps };
}

function findUnreadCreates(next: DesignTokens, ops: readonly FileOp[]): FileOp[] {
    return ops.filter((op) => op.kind === "create-file" && next.getText(op.file) === undefined);
}

/**
 * Applies an operation's result, as {@link apply} does.
 *
 * A question or a refusal is returned as it is.
 *
 * @param tokens - The design tokens the operation was made from.
 * @param result - The operation's result, such as from {@link rename}.
 *
 * @example
 * // Rename color.primary to color.brand
 * commit(tokens, rename(tokens, "color.primary", "brand")).moves
 * // => [{ from: "color.primary", to: "color.brand" }]
 */
export function commit(tokens: DesignTokens, result: OperationResult): CommitResult {
    if (!result.ops) return result;
    const next = apply(tokens, result.ops);
    if (next.conflicts) return next;
    return { tokens: next.tokens, ops: result.ops, moves: result.moves };
}

function applyOp(
    op: FileOp,
    style: string,
    texts: FileTexts,
    {
        getDraft,
        flushDraft,
    }: { getDraft: (file: string) => Draft | undefined; flushDraft: (file: string) => void },
): Conflict["kind"] | undefined {
    if (op.kind === "create-file" || op.kind === "delete-file") {
        flushDraft(op.file);
        return applyFileOp(texts, op, style);
    }
    const draft = getDraft(op.file);
    if (!draft) return "not-read";
    const outcome = applyMemberOp(draft, op);
    if (outcome !== "stale") return outcome?.conflict;
    flushDraft(op.file);
    return applyOp(op, style, texts, { getDraft, flushDraft });
}

function applyFileOp(
    texts: FileTexts,
    op: FileLevelOp,
    style: string,
): Conflict["kind"] | undefined {
    const existing = texts.get(op.file);
    if (op.kind === "delete-file") {
        if (existing === undefined) return undefined;
        if (existing !== op.was) return "changed";
        texts.set(op.file, null);
        return undefined;
    }
    if (existing !== undefined)
        return isEqualJson(getValueAt(existing, []), op.value) ? undefined : "taken";
    const eol = detectLineBreak(style);
    const fileText = JSON.stringify(op.value, null, detectIndentUnit(style));
    texts.set(op.file, fileText.replaceAll("\n", eol) + eol);
    return undefined;
}

function applyMemberOp(draft: Draft, op: MemberOp): MemberOpResult {
    const { text, pending } = draft;
    draft.root ??= parseTree(text);
    const { root } = draft;
    const node = root && findNodeAtLocation(root, [...op.jsonPath]);
    const splices = root && getOpSplices(text, root, op);
    const readRanges = node ? [...getReadRanges(node, op), ...(splices ?? [])] : [];
    if (pending.length > 0 && (!node || readRanges.some((range) => touches(range, pending)))) {
        return "stale";
    }
    const currentValue = node && (getNodeValue(node) as JsonValue);
    const addSplices = (conflictKind: Conflict["kind"]): MemberOpResult => {
        if (splices === undefined) return { conflict: conflictKind };
        pending.push(...splices);
        return undefined;
    };

    switch (op.kind) {
        case "set":
            if (!node) return { conflict: "gone" };
            if (isEqualJson(currentValue, op.value)) return undefined;
            if (!isEqualJson(currentValue, op.was)) return { conflict: "changed" };
            return addSplices("not-a-group");
        case "add":
            if (node)
                return isEqualJson(currentValue, op.value) ? undefined : { conflict: "taken" };
            return addSplices("not-a-group");
        case "remove":
            if (!node) return undefined;
            if (!isEqualJson(currentValue, op.was)) return { conflict: "changed" };
            return addSplices("not-a-group");
        case "rename-key": {
            if (!node) {
                const renamed =
                    root && findNodeAtLocation(root, [...op.jsonPath.slice(0, -1), op.name]);
                const renamedValue = renamed && (getNodeValue(renamed) as JsonValue);
                return isEqualJson(renamedValue, op.was) ? undefined : { conflict: "gone" };
            }
            return addSplices("taken");
        }
    }
}

function getOpSplices(text: string, root: Node, op: MemberOp): Splice[] | undefined {
    if (op.kind === "set" || op.kind === "add")
        return getSetSplices(text, root, op.jsonPath, op.value);
    const node = findNodeAtLocation(root, [...op.jsonPath]);
    if (!node) return op.kind === "remove" ? [] : undefined;
    return op.kind === "remove" ? getRemovalSplices(text, node) : getRenameSplices(node, op.name);
}

function getReadRanges(node: Node, op: MemberOp): { offset: number; length: number }[] {
    const container =
        op.kind === "rename-key" ? (node.parent?.parent ?? node) : (node.parent ?? node);
    const keys: Node[] = [];
    for (let at = node.parent; at; at = at.parent) {
        const key = at.type === "property" ? at.children?.[0] : undefined;
        if (key) keys.push(key);
    }
    return [container, ...keys];
}

function touches(range: { offset: number; length: number }, splices: Splice[]): boolean {
    return splices.some(
        (splice) =>
            range.offset <= splice.offset + splice.length &&
            splice.offset <= range.offset + range.length,
    );
}

export function applyOpToText(text: string, op: MemberOp): string | undefined {
    const root = parseTree(text);
    const splices = root && getOpSplices(text, root, op);
    return splices && applySplices(text, splices);
}
