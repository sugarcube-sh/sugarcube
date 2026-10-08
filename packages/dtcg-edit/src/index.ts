import type {
    Change,
    Document,
    Input,
    JsonPath,
    Move,
    ReadOptions,
    TokenType,
} from "@sugarcube-sh/dtcg";

/**
 * A design system and the text of its files, ready to edit.
 *
 * A project never changes: {@link apply} returns a new one and leaves this one as it was, so
 * undo is keeping the previous project.
 *
 * A project remembers the options it was read with, functions included, so it cannot be sent to
 * another process as it is. Send its `files`, and open it there with {@link openFromMemory} and
 * the same options.
 */
export interface Project {
    readonly doc: Document;
    /** The text of every file, keyed by path, as described at `ReadText` in `@sugarcube-sh/dtcg`. */
    readonly files: Readonly<Record<string, string>>;
    /** The options it was read with, for reading it again after an edit. */
    readonly options: ReadOptions;
}

export { open } from "./open.js";

/**
 * A replacement of some text in a file. The offset and length count UTF-16 code units, as a
 * `Span` in `@sugarcube-sh/dtcg` does.
 */
export interface TextEdit {
    file: string;
    offset: number;
    length: number;
    text: string;
}

/** A change that would mend a diagnostic, as {@link fixesFor} offers it. */
export interface Fix {
    /** What the fix does, for a menu or a prompt, such as "use `color.brand`, which has a similar name". */
    title: string;
    /**
     * Whether it can be applied without a person checking it. A safe fix, applied, leaves the place
     * it mends reading clean and changes nothing else the files mean; one that is not safe is a
     * likely guess a person should confirm.
     */
    safe: boolean;
    edits: TextEdit[];
}

export { fixesFor } from "./fixes.js";

/**
 * Opens a design system for editing from text already in memory, by the rules of
 * `readFromMemory` in `@sugarcube-sh/dtcg`.
 *
 * @example
 * const project = openFromMemory({ files, entry: "tokens.resolver.json" });
 */
export function openFromMemory(
    sources: {
        files: Record<string, string>;
        /** @default the only file, when there is one */
        entry?: string;
    },
    options?: ReadOptions,
): Project {
    throw new Error("not implemented yet");
}

/** Any JSON value. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * One change to one file, addressed by path so it still applies if the file has changed
 * elsewhere since it was read.
 *
 * - `set` changes something that exists. Its parent must exist.
 * - `add` adds something new, creating any missing groups on the way. It must not already exist.
 * - `remove` removes something. Nothing happens if it is already gone.
 * - `renameKey` renames a key, keeping its value and position.
 * - `createFile` creates a file holding `value`. It must not already exist.
 * - `deleteFile` deletes a file.
 *
 * `set`, `remove` and `deleteFile` record `was`, what they expect to find. If that has changed by
 * the time the edit is applied, the edit is a conflict rather than written over the change,
 * unless what it would write is already there.
 */
export type FileOp =
    | { kind: "set"; file: string; path: JsonPath; value: Json; was: Json }
    | { kind: "add"; file: string; path: JsonPath; value: Json }
    | { kind: "remove"; file: string; path: JsonPath; was: Json }
    | { kind: "renameKey"; file: string; path: JsonPath; name: string }
    | { kind: "createFile"; file: string; value: Json }
    | { kind: "deleteFile"; file: string; was: string };

/**
 * A question an operation cannot answer from the files alone. Answer it by calling the same
 * operation again with the answer.
 *
 * - `placement`: several files could hold the change. Answer with `{ place }`.
 * - `generated`: the token is made by a generator, from the setting on the group at `by`. Answer
 *   with {@link detach}.
 * - `inherited`: the token comes from another group. Answer with `{ inherited: "here" | "original" }`.
 *
 * `path` is the token the question is about, which matters when one operation changes several.
 */
export type Decision =
    | { kind: "placement"; path: string; candidates: string[] }
    | { kind: "generated"; path: string; by: string }
    | { kind: "inherited"; path: string; from: string; alsoAffects: string[] };

/** What an operation returns: the edits, a question, or a refusal with its reason. */
export type OpResult =
    | {
          ops: FileOp[];
          /** Other contexts where the change also shows, because they read the same file. */
          alsoAffects: Input[];
          /** References left pointing at nothing, after a {@link remove}. */
          broken?: string[];
          /** Tokens and groups whose path changed, such as after a {@link rename}. Empty when none did. */
          moved: Move[];
      }
    | { decision: Decision }
    | { refused: { reason: string } };

/** Where an edit goes. */
export interface Where {
    /**
     * The context the edit is for, such as `{ theme: "dark" }`. Modifiers at their default are
     * ignored, so a permutation's full input can be passed as it is. Naming two non-default
     * contexts is refused: no file is read only by that combination.
     * @default the base value, which every permutation shares
     */
    context?: Input;
    /** The answer to a `"placement"` question. */
    place?: string;
}

/** A new token, as it will be written into the file. */
export interface NewToken {
    /**
     * Its type. Leave it out when the group declares one, or when the value is a reference: the
     * token then takes its type from there, as the spec allows. Refused if no type can be worked out.
     */
    $type?: TokenType;
    /** Written exactly as given. */
    $value: Json;
    $description?: string;
}

/**
 * Renames a token or group, and updates every reference to it: `{…}` references, `$extends`,
 * `$ref` pointers, and fragments in the resolver.
 */
export function rename(project: Project, path: string, newName: string): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Changes a token's value.
 *
 * The value is written exactly as given, keeping the file's own spelling; use `toDTCGValue`
 * from `@sugarcube-sh/dtcg` to write a value taken from the model. The change is checked by
 * reading the result: a value wrong for the token's type, a reference to the wrong type, or a
 * reference that makes a loop is refused.
 *
 * @example
 * setValue(project, "color.danger", "{color.red.600}", { context: { theme: "dark" } })
 * setValue(project, "shadow.card", "{color.shadow}", { part: ["color"] })
 */
export function setValue(
    project: Project,
    path: string,
    value: Json,
    options?: ValueOptions,
): OpResult {
    throw new Error("not implemented yet");
}

/** How a value change is made: where it goes, and which part of the value it changes. */
export interface ValueOptions extends Where {
    /** A part of a composite value to change on its own, such as `["color"]` of a shadow. */
    part?: JsonPath;
    /** The answer to an `"inherited"` question. */
    inherited?: "here" | "original";
}

/**
 * Changes several values in one step, checked with one read, so a change that spans many tokens,
 * such as switching a palette, is accepted or refused as a whole. Each value follows the rules of
 * {@link setValue}.
 *
 * @example
 * setValues(project, [
 *   { path: "color.button.background", value: "{color.violet.500}" },
 *   { path: "color.button.background", value: "{color.violet.300}", context: { theme: "dark" } },
 * ])
 */
export function setValues(
    project: Project,
    values: ({ path: string; value: Json } & ValueOptions)[],
): OpResult {
    throw new Error("not implemented yet");
}

/** Creates a token or a group. */
export function create(
    project: Project,
    parent: string,
    name: string,
    token: NewToken | { group: true },
    options?: Where & {
        /**
         * The sibling to place it after.
         * @default the end of the group
         */
        after?: string;
    },
): OpResult {
    throw new Error("not implemented yet");
}

/** Moves a token or group among its siblings. */
export function reorder(
    project: Project,
    path: string,
    options: { after: string } | { before: string },
): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Moves a token or group to another group, another file, or both, and gives it a new name if
 * `name` is set. Refused when the new file is read by different contexts than the old one, since
 * the token would disappear from some of them.
 *
 * @example
 * move(project, "color.brand.500", { group: "color.primary", name: "600" })
 */
export function move(
    project: Project,
    path: string,
    to: { group?: string; file?: string; name?: string },
): OpResult {
    throw new Error("not implemented yet");
}

/** Removes a token or group, and reports the references it leaves pointing at nothing. */
export function remove(project: Project, path: string): OpResult {
    throw new Error("not implemented yet");
}

/** Changes a token's or group's description. `null` removes it. */
export function setDescription(
    project: Project,
    path: string,
    description: string | null,
): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Marks a token or group as deprecated, with a message saying what to use instead, or `true` for
 * none. `null` removes the mark.
 *
 * @example
 * deprecate(project, "color.old", "Use color.primary instead")
 */
export function deprecate(project: Project, path: string, reason: string | true | null): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Changes one setting inside a token's or group's `$extensions`, leaving the rest as written, so
 * other tools' settings are never touched. `at` starts with the extension's key; give only the
 * key to replace the whole extension. `null` removes the setting.
 *
 * @example
 * setExtension(project, "space", ["com.example", "scale", "ratio"], 1.333)
 */
export function setExtension(
    project: Project,
    path: string,
    at: JsonPath,
    value: Json | null,
): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Turns fixes offered for this project's diagnostics into ordinary edits, so they can be undone,
 * saved and replayed like any other. Pass several to make them one step. Every fix must come from
 * {@link fixesFor} for this project.
 *
 * @example
 * const safe = project.doc.diagnostics.flatMap((d) => fixesFor(project, d).filter((f) => f.safe));
 * commit(project, fix(project, safe));
 */
export function fix(project: Project, fixes: Fix[]): OpResult {
    throw new Error("not implemented yet");
}

/** Changes a token's type. Refused if tokens that refer to it would break. */
export function retype(project: Project, path: string, type: TokenType): OpResult {
    throw new Error("not implemented yet");
}

/** Turns a token made by a generator into an ordinary token written in the file. */
export function detach(project: Project, path: string): OpResult {
    throw new Error("not implemented yet");
}

/** Adds a file to a set or to a modifier's context in the resolver. */
export function addFile(
    project: Project,
    file: string,
    options: {
        to: { set: string } | { modifier: string; context: string };
        /**
         * The source to place it after.
         * @default the end
         */
        after?: string;
    },
): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Adds a context to a modifier, with a new file of its own.
 *
 * @example
 * addContext(project, "theme", "dim", { file: "dim.json", basedOn: "dark" })
 */
export function addContext(
    project: Project,
    modifier: string,
    context: string,
    options: {
        file: string;
        /** An existing context to build on: its files come first. */
        basedOn?: string;
    },
): OpResult {
    throw new Error("not implemented yet");
}

/** Adds a modifier to the resolver. */
export function addModifier(
    project: Project,
    modifier: string,
    options: { contexts: string[]; default?: string },
): OpResult {
    throw new Error("not implemented yet");
}

/** Renames a modifier's context. */
export function renameContext(
    project: Project,
    modifier: string,
    from: string,
    to: string,
): OpResult {
    throw new Error("not implemented yet");
}

/**
 * Removes a modifier's context. Its files are left on disk unless `deleteFiles` is set, because
 * deleting a file should be the person's choice. Only files no other context or set reads are
 * deleted.
 */
export function removeContext(
    project: Project,
    modifier: string,
    context: string,
    options?: {
        /** @default false */
        deleteFiles?: boolean;
    },
): OpResult {
    throw new Error("not implemented yet");
}

/** Sets a modifier's default context. */
export function setDefault(project: Project, modifier: string, context: string): OpResult {
    throw new Error("not implemented yet");
}

/** An edit that could no longer be made, such as a change to a token someone has since deleted. */
export interface Conflict {
    op: FileOp;
    reason: string;
}

/**
 * Applies edits to a project's text and reads the result, returning a new project, or the
 * edits that no longer apply: those whose place has gone, or whose `was` has changed since they
 * were made.
 */
export function apply(project: Project, ops: FileOp[]): Project | { conflicts: Conflict[] } {
    throw new Error("not implemented yet");
}

/** The outcome of {@link commit}. */
export type Committed =
    | {
          project: Project;
          /** The edits that were applied, for undo, saving, and sharing. */
          ops: FileOp[];
          /** Tokens and groups whose path changed, for keeping a selection or a URL on them. */
          moved: Move[];
      }
    | { decision: Decision }
    | { refused: { reason: string } }
    | { conflicts: Conflict[] };

/**
 * Applies an operation's result in one step.
 *
 * @example
 * const done = commit(project, rename(project, "color.brand", "primary"));
 * if ("project" in done) project = done.project;
 */
export function commit(project: Project, result: OpResult): Committed {
    throw new Error("not implemented yet");
}

/** Edits, with the moves they made, as they are kept for undo and saved for later. */
export interface Edits {
    ops: FileOp[];
    moved: Move[];
}

/**
 * The files that differ between two projects: each one's new text, or `null` where the file was
 * deleted. For saving somewhere that takes whole files, such as a pull request.
 */
export function changedFiles(before: Project, after: Project): Record<string, string | null> {
    throw new Error("not implemented yet");
}

/** Encodes edits and their moves as a compact string, for URLs and saved sessions. */
export function encodeEdits(edits: Edits): Promise<string> {
    throw new Error("not implemented yet");
}

/** Decodes edits encoded with {@link encodeEdits}. */
export function decodeEdits(text: string): Promise<Edits> {
    throw new Error("not implemented yet");
}

/**
 * An editing session: a project as a person edits it, with undo, the unsaved edits, and what
 * changed since it was opened. It changes as it is used, like a store; the projects inside it
 * never do. Writing is left to the tool: send {@link Session.unsaved} wherever saves go, then call
 * {@link Session.saved}.
 *
 * @example
 * const session = createSession(project);
 * session.do(rename(session.project, "color.brand", "primary"));
 * session.undo();
 */
export interface Session {
    /** The current version. */
    readonly project: Project;
    /** The version the unsaved edits are measured from: as opened, as last saved, or as last adopted. */
    readonly opened: Project;
    /** The edits since {@link Session.opened}, with the moves they made: what a save sends, and what to keep for a reload. */
    readonly unsaved: Edits;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /**
     * Commits an operation's result. On success the project moves on and the change goes on the
     * undo history; otherwise nothing changes, and the answer says why.
     */
    do(result: OpResult): Committed;
    /** Commits an operation's result without keeping it, for previewing, such as while a slider moves. */
    preview(result: OpResult): Committed;
    undo(): void;
    redo(): void;
    /** What changed since {@link Session.opened}, renames included. */
    changes(): Change[];
    /**
     * Records that the unsaved edits were saved: the current version becomes
     * {@link Session.opened}. Undo still works; undoing past a save makes unsaved edits that
     * revert it.
     */
    saved(): void;
    /** Goes back to {@link Session.opened} and drops the unsaved edits. The undo history starts again. */
    discard(): void;
    /**
     * Puts back unsaved edits kept from before a reload, on top of the current version. Returns the
     * edits that no longer apply; if there are any, nothing changes.
     */
    restore(unsaved: Edits): Conflict[];
    /**
     * Takes in files that changed underneath the session, such as after a `git pull`: the unsaved
     * edits are put back on top of `fresh`, which becomes {@link Session.opened}, and the undo
     * history starts again. Returns the edits that no longer apply; if there are any, nothing
     * changes.
     */
    adopt(fresh: Project): Conflict[];
    /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
    subscribe(listener: () => void): () => void;
}

/** Starts an editing session on a project. */
export function createSession(project: Project): Session {
    throw new Error("not implemented yet");
}
