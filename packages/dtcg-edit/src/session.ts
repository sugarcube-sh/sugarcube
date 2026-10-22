import { type DesignTokens, type Move, movedPath } from "@sugarcube-sh/dtcg";
import { applyStepsThatFit, commit } from "./apply.js";
import { clashesOf } from "./clashes.js";
import { thrown } from "./error-messages.js";
import type { Committed, EditStep, Edits, OpResult, Session } from "./index.js";

/**
 * Starts an editing session on design tokens.
 *
 * @example
 * const session = createSession(tokens);
 * session.do(setValue(session.tokens, "color.brand", "#e11d48"));
 * await save(session.unsaved);
 * session.markSaved();
 */
export function createSession(tokens: DesignTokens): Session {
    let current = tokens;
    let opened = tokens;
    let unsaved: Edits = { steps: [] };
    const counter = { made: 0 };
    let ids = followed(undefined, [], tokens, counter);
    let openedIds = ids;
    let befores: (Version | undefined)[] = [];
    let undone: Undone[] = [];
    const listeners = new Set<() => void>();
    const changed = () => {
        for (const listener of listeners) listener();
    };

    return {
        get tokens() {
            return current;
        },
        get opened() {
            return opened;
        },
        get unsaved() {
            return unsaved;
        },
        get canUndo() {
            return unsaved.steps.length > 0;
        },
        get canRedo() {
            return undone.length > 0;
        },
        do(result: OpResult): Committed {
            const done = commit(current, result);
            if (!done.tokens) return done;
            befores = [...befores, { tokens: current, ids }];
            undone = [];
            current = done.tokens;
            unsaved = { steps: [...unsaved.steps, { ops: done.ops, moved: done.moved }] };
            ids = followed(ids, done.moved, current, counter);
            changed();
            return done;
        },
        preview() {
            throw new Error("not implemented yet");
        },
        undo() {
            const step = unsaved.steps.at(-1);
            if (!step) return;
            const kept = unsaved.steps.slice(0, -1);
            const before = befores.at(-1) ?? workedOut(kept, step);
            undone = [...undone, { step, before, after: { tokens: current, ids } }];
            befores = befores.slice(0, -1);
            unsaved = { steps: kept };
            current = before.tokens;
            ids = before.ids;
            changed();
        },
        redo() {
            const last = undone.at(-1);
            if (!last) return;
            undone = undone.slice(0, -1);
            befores = [...befores, last.before];
            unsaved = { steps: [...unsaved.steps, last.step] };
            current = last.after.tokens;
            ids = last.after.ids;
            changed();
        },
        changes() {
            return current.diff(opened, { moved: movesIn(unsaved.steps) });
        },
        markSaved(saved) {
            const count = saved ? leadingSteps(saved, unsaved) : unsaved.steps.length;
            if (count === 0) return;
            const kept = unsaved.steps.slice(0, count);
            if (count === unsaved.steps.length) {
                opened = current;
                openedIds = ids;
            } else {
                opened = applyStepsThatFit(opened, kept).tokens;
                openedIds = followed(openedIds, movesIn(kept), opened, counter, ids);
            }
            unsaved = { steps: unsaved.steps.slice(count) };
            befores = befores.slice(count);
            undone = [];
            changed();
        },
        discard() {
            current = opened;
            unsaved = { steps: [] };
            ids = openedIds;
            befores = [];
            undone = [];
            changed();
        },
        restore(edits) {
            const { tokens: next, applied, skipped } = applyStepsThatFit(current, edits.steps);
            const clashes = clashesOf(skipped, current, next);
            if (applied.length === 0) return clashes;
            current = next;
            unsaved = { steps: [...unsaved.steps, ...applied] };
            ids = followed(ids, movesIn(applied), current, counter);
            befores = [...befores, ...applied.map(() => undefined)];
            undone = [];
            changed();
            return clashes;
        },
        rebase(fresh) {
            const { tokens: next, applied, skipped } = applyStepsThatFit(fresh, unsaved.steps);
            const clashes = clashesOf(skipped, fresh, next, [current, opened]);
            openedIds = followed(openedIds, [], fresh, counter);
            ids = followed(ids, [], next, counter, openedIds);
            opened = fresh;
            current = next;
            unsaved = { steps: applied };
            befores = applied.map(() => undefined);
            undone = [];
            changed();
            return clashes;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        idOf(path) {
            return ids.byPath.get(path);
        },
        pathOf(id) {
            return ids.byId.get(id);
        },
    };

    function workedOut(kept: readonly EditStep[], step: EditStep): Version {
        const { tokens: earlier, skipped } = applyStepsThatFit(opened, kept);
        if (skipped.length > 0) throw new Error(thrown.stepsNoLongerFit);
        const known = unmoved(ids, step.moved);
        return {
            tokens: earlier,
            ids: followed(openedIds, movesIn(kept), earlier, counter, known),
        };
    }
}

interface Version {
    tokens: DesignTokens;
    ids: Ids;
}

interface Undone {
    step: EditStep;
    before: Version;
    after: Version;
}

function unmoved(ids: Ids, moved: readonly Move[]): Ids {
    const back: Move[] = [];
    for (const { from, to } of moved) back.unshift({ from: to, to: from });
    const byId = new Map<string, string>();
    const byPath = new Map<string, string>();
    for (const [id, path] of ids.byId) {
        const was = movedPath(path, back);
        byId.set(id, was);
        byPath.set(was, id);
    }
    return { byId, byPath };
}

interface Ids {
    byId: ReadonlyMap<string, string>;
    byPath: ReadonlyMap<string, string>;
}

function followed(
    ids: Ids | undefined,
    moved: readonly Move[],
    tokens: DesignTokens,
    counter: { made: number },
    known?: Ids,
): Ids {
    const paths = pathsIn(tokens);
    const byId = new Map<string, string>();
    const byPath = new Map<string, string>();
    const set = (id: string, path: string) => {
        byId.set(id, path);
        byPath.set(path, id);
    };
    const from = ids?.byId ?? new Map([...paths].map((path) => [path, path]));
    for (const [id, path] of from) {
        const now = movedPath(path, moved);
        if (paths.has(now)) set(id, now);
    }
    const taken = (id: string) => byId.has(id) || (known?.byId.has(id) ?? false);
    for (const path of paths) {
        if (byPath.has(path)) continue;
        const hint = known?.byPath.get(path);
        if (hint !== undefined && !byId.has(hint)) {
            set(hint, path);
            continue;
        }
        let id: string;
        do id = `new:${++counter.made}`;
        while (taken(id));
        set(id, path);
    }
    return { byId, byPath };
}

function leadingSteps(saved: Edits, unsaved: Edits): number {
    const leading = saved.steps.every((step, index) => unsaved.steps[index] === step);
    return leading ? saved.steps.length : 0;
}

function movesIn(steps: readonly EditStep[]): Move[] {
    return steps.flatMap((step) => step.moved);
}

function pathsIn(tokens: DesignTokens): Set<string> {
    return new Set([...tokens.groupPaths(), ...tokens.tokenPaths()]);
}
