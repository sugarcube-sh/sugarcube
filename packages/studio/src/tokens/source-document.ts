import {
    type ResolvedTokens,
    type TokenSources,
    type TokenTree,
    composeTrees,
    resolveTokens,
} from "@sugarcube-sh/core/client";
import { type Handle, PathIndex } from "./path-index";
import { isSegment, parentPath } from "./paths";
import { type PathMoves, movedTo, renameInSources } from "./rename-in-sources";
import { type JsonPath, nodeAt } from "./text-edits";
import { type WriteOp, WriteOpFailed, applyWriteOps, opsByFile } from "./write-ops";

export type Problem = {
    kind: "invalid" | "missing-reference" | "circular";
    message: string;
    ref?: string;
};

export type SourceDocument = {
    sources: TokenSources;
    trees: TokenTree[];
    resolved: ResolvedTokens;
    index: PathIndex;
    problems: ReadonlyMap<Handle, Problem[]>;
    /** Everything done since the baseline, in order. What a save sends. */
    ops: readonly WriteOp[];
};

function collectProblems(
    index: PathIndex,
    errors: ReturnType<typeof resolveTokens>["errors"],
): Map<Handle, Problem[]> {
    const problems = new Map<Handle, Problem[]>();

    const add = (path: string, problem: Problem) => {
        const handle = index.handleAt(path);
        if (handle === undefined) return;

        const existing = problems.get(handle);
        if (existing) existing.push(problem);
        else problems.set(handle, [problem]);
    };

    for (const error of errors.validation) {
        add(error.path, { kind: "invalid", message: error.message });
    }

    for (const error of errors.resolution) {
        if (error.type === "missing" && error.referencedBy) {
            for (const referrer of error.referencedBy) {
                add(referrer, {
                    kind: "missing-reference",
                    message: error.message,
                    ...(error.ref === undefined ? {} : { ref: error.ref }),
                });
            }
            continue;
        }
        add(error.path, {
            kind: error.type === "circular" ? "circular" : "invalid",
            message: error.message,
        });
    }

    return problems;
}

/**
 * Rebuilds from the text. `previous` carries identity across the rebuild, and
 * `moves` says where a renamed path went, so a handle follows its node. A path
 * nothing held before gets itself as its handle, unless another node already
 * holds that name as its handle (a rename vacated it), in which case it gets a
 * fresh one.
 */
function derive(
    sources: TokenSources,
    ops: readonly WriteOp[],
    previous?: SourceDocument,
    moves?: PathMoves,
): SourceDocument {
    const { trees } = composeTrees(sources);
    const { resolved, errors } = resolveTokens(trees);

    let identify: ((path: string) => Handle) | undefined;
    if (previous) {
        const before = new Map<string, Handle>();
        for (const [path, handle] of previous.index.allHandles()) {
            before.set(moves ? (movedTo(path, moves) ?? path) : path, handle);
        }
        const claimed = new Set(before.values());

        identify = (path) => {
            const known = before.get(path);
            if (known !== undefined) return known;

            let handle = path;
            for (let n = 1; claimed.has(handle); n++) handle = `new:${path}:${n}`;
            before.set(path, handle);
            claimed.add(handle);
            return handle;
        };
    }

    const index = new PathIndex(resolved, identify);
    return { sources, trees, resolved, index, problems: collectProblems(index, errors), ops };
}

export function openDocument(sources: TokenSources): SourceDocument {
    return derive(sources, []);
}

/**
 * The files Studio will write: those every context reads whole. A source read
 * through a pointer (an inline source, or `file.json#/section`) declares its
 * tokens somewhere below the file's root, and an edit addressed by token path
 * would land at the root instead. Until an edit can carry the pointer, such a
 * file is read-only.
 */
export function writableFiles(sources: TokenSources): string[] {
    const pointered = new Set<string>();
    for (const { sources: refs } of sources.order) {
        for (const ref of refs) if (ref.pointer !== undefined) pointered.add(ref.file);
    }
    return Object.keys(sources.files).filter((file) => !pointered.has(file));
}

export type Adopted = {
    baseline: SourceDocument;
    doc: SourceDocument;
    /** Files where disk moved under an edit, so both versions now exist. */
    conflicts: readonly string[];
};

/** The text of one node, for asking whether two versions changed the same one. */
function textAt(text: string, path: JsonPath): string | undefined {
    const node = nodeAt(text, path);
    return node === undefined ? undefined : text.slice(node.offset, node.offset + node.length);
}

/**
 * The files changed outside Studio.
 *
 * A file this copy left alone takes the new text — `held === was`, a string
 * comparison, which is what holding the text buys. A file both changed has our
 * operations replayed onto the arriving text, so an edit to one token and an
 * outside edit to another in the same file both survive. Only the same node
 * being touched twice is a conflict, which is the unit D-043 sets for saving.
 */
export function adoptSources(
    doc: SourceDocument,
    baseline: SourceDocument,
    next: TokenSources,
): Adopted {
    const nextBaseline = derive(next, [], baseline);

    const files: Record<string, string> = {};
    const conflicts: string[] = [];
    const mine = new Set<string>();

    for (const [file, arriving] of Object.entries(next.files)) {
        const held = doc.sources.files[file];
        const was = baseline.sources.files[file];

        if (held === undefined || held === was) {
            files[file] = arriving;
            continue;
        }

        mine.add(file);

        if (was === undefined || arriving === was) {
            files[file] = held;
            continue;
        }

        const ops = doc.ops.filter((op) => op.file === file);
        if (ops.length === 0) {
            files[file] = held;
            conflicts.push(file);
            continue;
        }

        try {
            files[file] = applyWriteOps(arriving, ops, file);
            if (touchedTwice(ops, was, arriving)) conflicts.push(file);
        } catch {
            files[file] = held;
            conflicts.push(file);
        }
    }

    // An edited file disk no longer lists cannot be kept — it is out of the
    // resolution order, so there is nowhere for its text to sit.
    for (const [file, held] of Object.entries(doc.sources.files)) {
        if (next.files[file] !== undefined) continue;
        if (held !== baseline.sources.files[file]) conflicts.push(file);
    }

    if (mine.size === 0) return { baseline: nextBaseline, doc: nextBaseline, conflicts };

    const ops = doc.ops.filter((op) => mine.has(op.file));
    return { baseline: nextBaseline, doc: derive({ ...next, files }, ops, doc), conflicts };
}

/**
 * A rename is left out: as long as the key is still there it applies, and
 * comparing its whole subtree would report every change underneath it.
 */
function touchedTwice(ops: readonly WriteOp[], was: string, arriving: string): boolean {
    return ops.some(
        (op) => op.kind !== "renameKey" && textAt(was, op.path) !== textAt(arriving, op.path),
    );
}

/**
 * The ops replayed onto the text, or null when one of them no longer fits it.
 * An edit made here is refused rather than written somewhere it does not
 * belong; anything else thrown is a bug and goes up.
 */
function tryReplay(text: string, ops: readonly WriteOp[], file: string): string | null {
    try {
        return applyWriteOps(text, ops, file);
    } catch (error) {
        if (error instanceof WriteOpFailed) return null;
        throw error;
    }
}

/** One operation applied to its file, and the document rebuilt around it. */
function edit(doc: SourceDocument, op: WriteOp): SourceDocument | null {
    const text = doc.sources.files[op.file];
    if (text === undefined) return null;

    const replayed = tryReplay(text, [op], op.file);
    if (replayed === null) return null;
    const files = { ...doc.sources.files, [op.file]: replayed };
    return derive({ ...doc.sources, files }, [...doc.ops, op], doc);
}

type Target = { path: string; file: string };

/** Where an edit to this node in this context lands: its path, and a file Studio may write. */
function targetFor(doc: SourceDocument, handle: Handle, context: string): Target | undefined {
    const path = doc.index.pathOf(handle);
    if (path === undefined) return undefined;

    const entries = doc.index.entriesFor(handle);
    const entry = entries.find((each) => each.context === context) ?? entries[0];
    if (!entry) return undefined;

    const node = doc.resolved[entry.key] as { $source?: { sourcePath?: string } } | undefined;
    const file = node?.$source?.sourcePath;
    if (file === undefined || !writableFiles(doc.sources).includes(file)) return undefined;

    return { path, file };
}

/** Whether the node at `path`, or anything under it, is declared in a file Studio may not write. */
function reachesReadOnly(doc: SourceDocument, path: string): boolean {
    const writable = new Set(writableFiles(doc.sources));
    const own = doc.index.handleAt(path);
    const handles = own === undefined ? [] : [own, ...doc.index.under(path)];

    for (const handle of handles) {
        const entries = [...doc.index.entriesFor(handle), ...doc.index.groupEntriesFor(handle)];
        for (const { key } of entries) {
            const node = doc.resolved[key] as { $source?: { sourcePath?: string } } | undefined;
            const file = node?.$source?.sourcePath;
            if (file !== undefined && !writable.has(file)) return true;
        }
    }
    return false;
}

export type ValueUpdate = { handle: Handle; value: unknown; context: string };

/**
 * Several values at once, derived once. Two contexts that read a token from
 * the same file are one write to one place, so one op; contexts that declare
 * it in different files are one op each. Null when any target is refused.
 */
export function setValues(
    doc: SourceDocument,
    updates: readonly ValueUpdate[],
): SourceDocument | null {
    const ops = new Map<string, WriteOp>();
    for (const { handle, value, context } of updates) {
        const target = targetFor(doc, handle, context);
        if (!target) return null;
        const path = [...target.path.split("."), "$value"];
        ops.set(`${target.file}\u0000${path.join(".")}`, {
            kind: "set",
            file: target.file,
            path,
            value,
        });
    }
    if (ops.size === 0) return doc;

    const files = { ...doc.sources.files };
    for (const op of ops.values()) {
        const replayed = tryReplay(files[op.file] as string, [op], op.file);
        if (replayed === null) return null;
        files[op.file] = replayed;
    }
    return derive({ ...doc.sources, files }, [...doc.ops, ...ops.values()], doc);
}

export function setValue(
    doc: SourceDocument,
    handle: Handle,
    value: unknown,
    context: string,
): SourceDocument | null {
    return setValues(doc, [{ handle, value, context }]);
}

export function setDescription(
    doc: SourceDocument,
    handle: Handle,
    description: string | undefined,
    context: string,
): SourceDocument | null {
    const target = targetFor(doc, handle, context);
    if (!target) return null;

    const path = [...target.path.split("."), "$description"];
    return edit(
        doc,
        description === undefined
            ? { kind: "remove", file: target.file, path }
            : { kind: "set", file: target.file, path, value: description },
    );
}

export type NewNode = {
    parent?: Handle;
    name: string;
    sourcePath: string;
    token?: { $type: string; $value: unknown };
};

/** The path a new node would have: under its parent group, or at the root. */
export function childPath(
    doc: SourceDocument,
    parent: Handle | undefined,
    name: string,
): string | undefined {
    if (!isSegment(name)) return undefined;
    if (parent === undefined) return name;

    const above = doc.index.pathOf(parent);
    if (above === undefined || !doc.index.isGroup(parent)) return undefined;
    return `${above}.${name}`;
}

export function create(doc: SourceDocument, node: NewNode): SourceDocument | null {
    const path = childPath(doc, node.parent, node.name);
    if (path === undefined) return null;
    if (doc.index.handleAt(path) !== undefined) return null;
    if (!writableFiles(doc.sources).includes(node.sourcePath)) return null;

    const written = node.token ? { $type: node.token.$type, $value: node.token.$value } : {};
    return edit(doc, { kind: "add", file: node.sourcePath, path: path.split("."), value: written });
}

export function remove(doc: SourceDocument, handle: Handle): SourceDocument | null {
    const path = doc.index.pathOf(handle);
    if (path === undefined || reachesReadOnly(doc, path)) return null;

    const at = path.split(".");
    const ops: WriteOp[] = [];
    for (const [file, text] of Object.entries(doc.sources.files)) {
        if (nodeAt(text, at) !== undefined) ops.push({ kind: "remove", file, path: at });
    }
    if (ops.length === 0) return null;

    const files = { ...doc.sources.files };
    for (const op of ops) files[op.file] = applyWriteOps(files[op.file] as string, [op], op.file);

    return derive({ ...doc.sources, files }, [...doc.ops, ...ops], doc);
}

export function rename(doc: SourceDocument, handle: Handle, name: string): SourceDocument | null {
    const from = doc.index.pathOf(handle);
    if (from === undefined || !isSegment(name)) return null;

    const parent = parentPath(from);
    const to = parent ? `${parent}.${name}` : name;
    if (to === from) return doc;
    if (doc.index.handleAt(to) !== undefined || reachesReadOnly(doc, from)) return null;

    const renamed = renameInSources(doc.sources, from, to);
    if (!renamed) return null;

    return derive(renamed.sources, [...doc.ops, ...renamed.ops], doc, renamed.moves);
}

/**
 * A document rebuilt from a baseline and a list of operations, which is what
 * a dock that reloaded with its page holds. Each rename is replayed as the key
 * move it was, in order, so handles stay the baseline paths (D-039). Null when
 * an operation no longer applies, because the file moved underneath it.
 */
export function replayOps(
    baseline: SourceDocument,
    ops: readonly WriteOp[],
): SourceDocument | null {
    if (ops.length === 0) return baseline;

    const files: Record<string, string> = { ...baseline.sources.files };
    try {
        for (const file of opsByFile(ops)) {
            const text = files[file.path];
            if (text === undefined) return null;
            files[file.path] = applyWriteOps(text, file.ops, file.path);
        }
    } catch {
        return null;
    }

    const moves: Array<readonly [string, string]> = [];
    for (const op of ops) {
        if (op.kind !== "renameKey") continue;
        moves.push([op.path.join("."), [...op.path.slice(0, -1), op.name].join(".")]);
    }

    return derive({ ...baseline.sources, files }, ops, baseline, moves);
}
