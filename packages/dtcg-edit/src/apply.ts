import { type DesignTokens, type JsonValue, isEqualJson } from "@sugarcube-sh/dtcg";
import { type Node, findNodeAtLocation, getNodeValue, parseTree } from "jsonc-parser";
import { conflict } from "./error-messages.js";
import type { Applied, Committed, Conflict, EditStep, Edits, FileOp, OpResult } from "./index.js";
import { type Splice, indentUnit, lineBreak, removal, spliced } from "./json-text.js";
import { renameSplices, setSplices, valueAt } from "./text-edits.js";

type MemberOp = Exclude<FileOp, { kind: "createFile" | "deleteFile" }>;
type FileLevelOp = Extract<FileOp, { kind: "createFile" | "deleteFile" }>;
type Outcome = { conflict: Conflict["kind"] } | "stale" | undefined;
type Changed = Record<string, string | null>;

interface Draft {
    text: string;
    root?: Node | undefined;
    pending: Splice[];
}

interface Texts {
    of(file: string): string | undefined;
    set(file: string, text: string | null): void;
}

/**
 * Applies edits to the design tokens' text in order and reads the result as they were read,
 * returning the new design tokens. Every other line of each file is left as written.
 *
 * All or nothing: if any edit no longer applies, none is made, and every such edit comes back
 * with its reason. An edit no longer applies when its place has gone, when what it expects to
 * find (`was`) has changed since it was made, or when its file is one the design tokens aren't read
 * from, a new file included. An edit whose result is already there does nothing.
 *
 * @example
 * const next = apply(tokens, saved.ops);
 * if (next.conflicts) showConflicts(next.conflicts);
 * else tokens = next.tokens;
 */
export function apply(tokens: DesignTokens, ops: readonly FileOp[]): Applied {
    const changes = changedBy(tokens, ops);
    return changes.conflicts ? { conflicts: changes.conflicts } : { tokens: changes.tokens };
}

/**
 * What saving edits would do to the files, without saving them: the new text of each file the edits
 * change, and the files they delete, with the design tokens as read from the result. Only a
 * `deleteFile` edit deletes a file, so one the resolver stops naming is kept. For saving somewhere
 * that takes whole files, such as a pull request. All or nothing, as {@link apply}: if any edit no
 * longer applies, the answer is the conflicts.
 *
 * @example
 * const changes = changedFiles(tokens, session.unsaved);
 * if (changes.conflicts) showConflicts(changes.conflicts);
 * else await openPullRequest(changes);
 */
export function changedFiles(tokens: DesignTokens, edits: Edits): FilesChanged {
    return changedBy(
        tokens,
        edits.steps.flatMap((step) => step.ops),
    );
}

type FilesChanged =
    | {
          tokens: DesignTokens;
          written: Record<string, string>;
          deleted: string[];
          conflicts?: undefined;
      }
    | { conflicts: Conflict[]; tokens?: undefined };

function changedBy(tokens: DesignTokens, ops: readonly FileOp[]): FilesChanged {
    const { changed, conflicts } = editedFiles(tokens, [{ ops, moved: [] }]);
    if (conflicts.length > 0) return { conflicts };
    const next = tokens.reread(changed);
    const lost = unread(next, ops);
    if (lost.length > 0) return { conflicts: lost.map((op) => conflict(op, "not-read")) };

    const written = Object.entries(changed)
        .flatMap(([file, text]): [string, string][] =>
            text !== null && text !== tokens.getText(file) ? [[file, text]] : [],
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const deleted = Object.keys(changed).filter((file) => changed[file] === null);
    return { tokens: next, written: Object.fromEntries(written), deleted: deleted.sort() };
}

export function applyStepsThatFit(
    tokens: DesignTokens,
    steps: readonly EditStep[],
): { tokens: DesignTokens; applied: readonly EditStep[]; skipped: readonly EditStep[] } {
    let trying = steps;
    for (;;) {
        const { changed, fitting } = editedFiles(tokens, trying);
        const next = fitting.length === 0 ? tokens : tokens.reread(changed);
        const lost = fitting.filter((step) => unread(next, step.ops).length > 0);
        if (lost.length === 0) {
            const kept = new Set(fitting);
            const skipped = steps.filter((step) => !kept.has(step));
            return { tokens: next, applied: fitting, skipped };
        }
        trying = fitting.filter((step) => !lost.includes(step));
    }
}

function editedFiles(tokens: DesignTokens, steps: readonly EditStep[]) {
    let changed: Changed = {};
    const texts: Texts = {
        of: (file) => (file in changed ? (changed[file] ?? undefined) : tokens.getText(file)),
        set: (file, text) => {
            changed[file] = text;
        },
    };
    let drafts = new Map<string, Draft>();
    const style = texts.of(tokens.entryFile) ?? "";
    const written = (file: string) => {
        const draft = drafts.get(file);
        if (draft && draft.pending.length > 0) texts.set(file, spliced(draft.text, draft.pending));
        drafts.delete(file);
    };
    const draftOf = (file: string) => {
        const text = texts.of(file);
        const draft = drafts.get(file) ?? (text === undefined ? undefined : { text, pending: [] });
        if (draft) drafts.set(file, draft);
        return draft;
    };
    const conflicts: Conflict[] = [];
    const fitting: EditStep[] = [];
    for (const step of steps) {
        const before = { changed: { ...changed }, drafts: new Map(drafts) };
        const pendingBefore = new Map(
            [...drafts].map(([file, draft]) => [file, draft.pending.length]),
        );
        const found: Conflict[] = [];
        for (const op of step.ops) {
            const kind = applyOne(op, style, texts, { draftOf, written });
            if (kind !== undefined) found.push(conflict(op, kind));
        }
        if (found.length === 0) {
            fitting.push(step);
            continue;
        }
        conflicts.push(...found);
        changed = before.changed;
        drafts = before.drafts;
        for (const [file, draft] of drafts) draft.pending.length = pendingBefore.get(file) ?? 0;
    }
    for (const file of drafts.keys()) written(file);
    return { changed, conflicts, fitting };
}

function unread(next: DesignTokens, ops: readonly FileOp[]): FileOp[] {
    return ops.filter((op) => op.kind === "createFile" && next.getText(op.file) === undefined);
}

/**
 * Applies an operation's result in one step, as {@link apply} does. A question or a refusal is
 * handed back untouched.
 *
 * @example
 * const done = commit(tokens, rename(tokens, "color.brand", "primary"));
 * if (done.tokens) tokens = done.tokens;
 */
export function commit(tokens: DesignTokens, result: OpResult): Committed {
    if (!result.ops) return result;
    const next = apply(tokens, result.ops);
    if (next.conflicts) return next;
    return { tokens: next.tokens, ops: result.ops, moved: result.moved };
}

function applyOne(
    op: FileOp,
    style: string,
    texts: Texts,
    {
        draftOf,
        written,
    }: { draftOf: (file: string) => Draft | undefined; written: (file: string) => void },
): Conflict["kind"] | undefined {
    if (op.kind === "createFile" || op.kind === "deleteFile") {
        written(op.file);
        return fileEdit(texts, op, style);
    }
    const draft = draftOf(op.file);
    if (!draft) return "not-read";
    const outcome = memberEdit(draft, op);
    if (outcome !== "stale") return outcome?.conflict;
    written(op.file);
    return applyOne(op, style, texts, { draftOf, written });
}

function fileEdit(texts: Texts, op: FileLevelOp, style: string): Conflict["kind"] | undefined {
    const existing = texts.of(op.file);
    if (op.kind === "deleteFile") {
        if (existing === undefined) return undefined;
        if (existing !== op.was) return "changed";
        texts.set(op.file, null);
        return undefined;
    }
    if (existing !== undefined)
        return isEqualJson(valueAt(existing, []), op.value) ? undefined : "taken";
    const eol = lineBreak(style);
    const written = JSON.stringify(op.value, null, indentUnit(style));
    texts.set(op.file, written.replaceAll("\n", eol) + eol);
    return undefined;
}

function memberEdit(draft: Draft, op: MemberOp): Outcome {
    const { text, pending } = draft;
    draft.root ??= parseTree(text);
    const { root } = draft;
    const node = root && findNodeAtLocation(root, [...op.jsonPath]);
    const splices = root && splicesFor(text, root, op);
    const reached = node ? [...reads(node, op), ...(splices ?? [])] : [];
    if (pending.length > 0 && (!node || reached.some((range) => touches(range, pending)))) {
        return "stale";
    }
    const current = node && (getNodeValue(node) as JsonValue);
    const written = (unwritable: Conflict["kind"]): Outcome => {
        if (splices === undefined) return { conflict: unwritable };
        pending.push(...splices);
        return undefined;
    };

    switch (op.kind) {
        case "set":
            if (!node) return { conflict: "gone" };
            if (isEqualJson(current, op.value)) return undefined;
            if (!isEqualJson(current, op.was)) return { conflict: "changed" };
            return written("not-a-group");
        case "add":
            if (node) return isEqualJson(current, op.value) ? undefined : { conflict: "taken" };
            return written("not-a-group");
        case "remove":
            if (!node) return undefined;
            if (!isEqualJson(current, op.was)) return { conflict: "changed" };
            return written("not-a-group");
        case "renameKey": {
            if (!node) {
                const renamed =
                    root && findNodeAtLocation(root, [...op.jsonPath.slice(0, -1), op.name]);
                const there = renamed && (getNodeValue(renamed) as JsonValue);
                return isEqualJson(there, op.was) ? undefined : { conflict: "gone" };
            }
            return written("taken");
        }
    }
}

function splicesFor(text: string, root: Node, op: MemberOp): Splice[] | undefined {
    if (op.kind === "set" || op.kind === "add")
        return setSplices(text, root, op.jsonPath, op.value);
    const node = findNodeAtLocation(root, [...op.jsonPath]);
    if (!node) return op.kind === "remove" ? [] : undefined;
    return op.kind === "remove" ? removal(text, node) : renameSplices(node, op.name);
}

function reads(node: Node, op: MemberOp): { offset: number; length: number }[] {
    const own = op.kind === "renameKey" ? (node.parent?.parent ?? node) : (node.parent ?? node);
    const keys: Node[] = [];
    for (let at = node.parent; at; at = at.parent) {
        const key = at.type === "property" ? at.children?.[0] : undefined;
        if (key) keys.push(key);
    }
    return [own, ...keys];
}

function touches(range: { offset: number; length: number }, splices: Splice[]): boolean {
    return splices.some(
        (splice) =>
            range.offset <= splice.offset + splice.length &&
            splice.offset <= range.offset + range.length,
    );
}

export function editedText(text: string, op: MemberOp): string | undefined {
    const root = parseTree(text);
    const splices = root && splicesFor(text, root, op);
    return splices && spliced(text, splices);
}
