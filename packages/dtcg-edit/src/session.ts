import { type DesignTokens, type Move, tokenPath } from "@sugarcube-sh/dtcg";
import { applyStepsThatFit, commit } from "./apply.js";
import { findClashes } from "./clashes.js";
import { exceptionMessages } from "./error-messages.js";
import { mergeSteps } from "./merge.js";
import type { CommitResult, EditStep, Edits, OperationResult, Session } from "./index.js";

/**
 * Starts an editing session on design tokens.
 *
 * @example
 * const session = createSession(tokens);
 * session.do(setValue(session.tokens, "color.brand", "#e11d48"));
 * await save(session.unsavedEdits);
 * session.markSaved();
 */
export function createSession(tokens: DesignTokens): Session {
    let currentTokens = tokens;
    let savedTokens = tokens;
    let unsavedEdits: Edits = { steps: [] };
    let undoStack: readonly UndoEntry[] = [];
    let redoStack: readonly RedoEntry[] = [];
    let mergeKey: string | undefined;
    const idCounter = { count: 0 };
    let ids = trackIDs(undefined, [], tokens, idCounter);
    let savedIDs = ids;
    const listeners = new Set<() => void>();
    const notify = () => {
        for (const listener of listeners) listener();
    };
    const setUndoStack = (next: readonly UndoEntry[]) => {
        undoStack = next;
        unsavedEdits = { steps: next.map(({ step }) => step) };
    };

    return {
        get tokens() {
            return currentTokens;
        },
        get savedTokens() {
            return savedTokens;
        },
        get unsavedEdits() {
            return unsavedEdits;
        },
        get canUndo() {
            return undoStack.length > 0;
        },
        get canRedo() {
            return redoStack.length > 0;
        },
        do(result: OperationResult, options = {}): CommitResult {
            const committed = commit(currentTokens, result);
            if (!committed.tokens) return committed;
            const step = { ops: committed.ops, moves: committed.moves };
            const last = undoStack.at(-1);
            const earlier = undoStack.slice(0, -1);
            redoStack = [];
            if (last?.before && options.mergeKey !== undefined && options.mergeKey === mergeKey) {
                const mergedStep = mergeSteps(last.step, step);
                if (mergedStep.ops.length > 0 || mergedStep.moves.length > 0) {
                    setUndoStack([...earlier, { step: mergedStep, before: last.before }]);
                    currentTokens = committed.tokens;
                    ids = trackIDs(ids, committed.moves, currentTokens, idCounter);
                } else {
                    setUndoStack(earlier);
                    currentTokens = last.before.tokens;
                    ids = last.before.ids;
                    mergeKey = undefined;
                }
            } else {
                setUndoStack([...undoStack, { step, before: { tokens: currentTokens, ids } }]);
                currentTokens = committed.tokens;
                ids = trackIDs(ids, committed.moves, currentTokens, idCounter);
                mergeKey = options.mergeKey;
            }
            notify();
            return { ...committed, tokens: currentTokens };
        },
        endStep() {
            mergeKey = undefined;
        },
        preview() {
            throw new Error("not implemented yet");
        },
        undo() {
            const last = undoStack.at(-1);
            if (!last) return;
            const earlier = undoStack.slice(0, -1);
            const before = last.before ?? replayVersionBefore(earlier, last.step);
            redoStack = [
                ...redoStack,
                { step: last.step, before, after: { tokens: currentTokens, ids } },
            ];
            setUndoStack(earlier);
            currentTokens = before.tokens;
            ids = before.ids;
            mergeKey = undefined;
            notify();
        },
        redo() {
            const last = redoStack.at(-1);
            if (!last) return;
            redoStack = redoStack.slice(0, -1);
            setUndoStack([...undoStack, { step: last.step, before: last.before }]);
            currentTokens = last.after.tokens;
            ids = last.after.ids;
            notify();
        },
        getChanges() {
            return currentTokens.getChangesSince(savedTokens, {
                moves: getMoves(unsavedEdits.steps),
            });
        },
        markSaved(sent) {
            const count = sent ? countSavedSteps(sent, unsavedEdits) : unsavedEdits.steps.length;
            if (count === 0) return;
            const savedSteps = unsavedEdits.steps.slice(0, count);
            if (count === unsavedEdits.steps.length) {
                savedTokens = currentTokens;
                savedIDs = ids;
            } else {
                savedTokens = applyStepsThatFit(savedTokens, savedSteps).tokens;
                savedIDs = trackIDs(savedIDs, getMoves(savedSteps), savedTokens, idCounter, ids);
            }
            setUndoStack(undoStack.slice(count));
            redoStack = [];
            notify();
        },
        discard() {
            currentTokens = savedTokens;
            setUndoStack([]);
            ids = savedIDs;
            redoStack = [];
            notify();
        },
        restore(edits) {
            const {
                tokens: next,
                applied,
                skipped,
            } = applyStepsThatFit(currentTokens, edits.steps);
            const clashes = findClashes(skipped, currentTokens, next);
            if (applied.length === 0) return clashes;
            currentTokens = next;
            setUndoStack([...undoStack, ...applied.map((step) => ({ step }))]);
            ids = trackIDs(ids, getMoves(applied), currentTokens, idCounter);
            redoStack = [];
            notify();
            return clashes;
        },
        rebase(fresh) {
            const { tokens: next, applied, skipped } = applyStepsThatFit(fresh, unsavedEdits.steps);
            const clashes = findClashes(skipped, fresh, next, [currentTokens, savedTokens]);
            savedIDs = trackIDs(savedIDs, [], fresh, idCounter);
            ids = trackIDs(ids, [], next, idCounter, savedIDs);
            savedTokens = fresh;
            currentTokens = next;
            setUndoStack(applied.map((step) => ({ step })));
            redoStack = [];
            notify();
            return clashes;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getID(path) {
            return ids.idByPath.get(path);
        },
        getPath(id) {
            return ids.pathByID.get(id);
        },
    };

    function replayVersionBefore(earlier: readonly UndoEntry[], step: EditStep): Version {
        const steps = earlier.map((each) => each.step);
        const { tokens: before, skipped } = applyStepsThatFit(savedTokens, steps);
        if (skipped.length > 0) throw new Error(exceptionMessages.stepsNoLongerFit);
        const known = reverseMoves(ids, step.moves);
        return {
            tokens: before,
            ids: trackIDs(savedIDs, getMoves(steps), before, idCounter, known),
        };
    }
}

interface UndoEntry {
    readonly step: EditStep;
    readonly before?: Version;
}

interface Version {
    readonly tokens: DesignTokens;
    readonly ids: IDs;
}

interface RedoEntry {
    readonly step: EditStep;
    readonly before: Version;
    readonly after: Version;
}

function reverseMoves(ids: IDs, moves: readonly Move[]): IDs {
    const reversedMoves: Move[] = [];
    for (const { from, to } of moves) reversedMoves.unshift({ from: to, to: from });
    const pathByID = new Map<string, string>();
    const idByPath = new Map<string, string>();
    for (const [id, path] of ids.pathByID) {
        const oldPath = tokenPath.applyMoves(path, reversedMoves);
        pathByID.set(id, oldPath);
        idByPath.set(oldPath, id);
    }
    return { pathByID, idByPath };
}

interface IDs {
    pathByID: ReadonlyMap<string, string>;
    idByPath: ReadonlyMap<string, string>;
}

function trackIDs(
    ids: IDs | undefined,
    moves: readonly Move[],
    tokens: DesignTokens,
    idCounter: { count: number },
    reservedIDs?: IDs,
): IDs {
    const paths = getAllPaths(tokens);
    const pathByID = new Map<string, string>();
    const idByPath = new Map<string, string>();
    const set = (id: string, path: string) => {
        pathByID.set(id, path);
        idByPath.set(path, id);
    };
    const previousPathByID = ids?.pathByID ?? new Map([...paths].map((path) => [path, path]));
    for (const [id, path] of previousPathByID) {
        const newPath = tokenPath.applyMoves(path, moves);
        if (paths.has(newPath)) set(id, newPath);
    }
    const isTaken = (id: string) => pathByID.has(id) || (reservedIDs?.pathByID.has(id) ?? false);
    for (const path of paths) {
        if (idByPath.has(path)) continue;
        const hint = reservedIDs?.idByPath.get(path);
        if (hint !== undefined && !pathByID.has(hint)) {
            set(hint, path);
            continue;
        }
        let id: string;
        do id = `new:${++idCounter.count}`;
        while (isTaken(id));
        set(id, path);
    }
    return { pathByID, idByPath };
}

function countSavedSteps(sent: Edits, unsavedEdits: Edits): number {
    const isPrefix = sent.steps.every((step, index) => unsavedEdits.steps[index] === step);
    return isPrefix ? sent.steps.length : 0;
}

function getMoves(steps: readonly EditStep[]): Move[] {
    return steps.flatMap((step) => step.moves);
}

function getAllPaths(tokens: DesignTokens): Set<string> {
    return new Set([...tokens.getGroupPaths(), ...tokens.getTokenPaths()]);
}
