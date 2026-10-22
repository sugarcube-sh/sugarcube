import type {
    Change,
    DesignTokens,
    Input,
    JsonPath,
    JsonValue,
    Move,
    PermutationErrorDetail,
    Permutations,
    Span,
    TokenType,
} from "@sugarcube-sh/dtcg";

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
    edits: readonly TextEdit[];
}

export { fixesFor } from "./fixes.js";

/**
 * One change to one file, addressed by its route through the file's JSON (`jsonPath`), so it still
 * applies if the file has changed elsewhere since it was read.
 *
 * - `set` changes something that exists. Its parent must exist.
 * - `add` adds something new, creating any missing groups on the way. It must not already exist.
 * - `remove` removes something. Nothing happens if it is already gone.
 * - `renameKey` renames a key, keeping its value and position. Nothing happens if a sibling
 *   already has the new name and holds `was`.
 * - `createFile` creates a file holding `value`. It must not already exist.
 * - `deleteFile` deletes a file.
 *
 * `set`, `remove` and `deleteFile` record `was`, what they expect to find. If that has changed by
 * the time the edit is applied, the edit is a conflict rather than written over the change,
 * unless what it would write is already there. `renameKey` records `was`, the value at the key,
 * only to tell when the rename is already done: the key is renamed whatever its value now.
 */
export type FileOp = Readonly<
    | { kind: "set"; file: string; jsonPath: JsonPath; value: JsonValue; was: JsonValue }
    | { kind: "add"; file: string; jsonPath: JsonPath; value: JsonValue }
    | { kind: "remove"; file: string; jsonPath: JsonPath; was: JsonValue }
    | { kind: "renameKey"; file: string; jsonPath: JsonPath; name: string; was: JsonValue }
    | { kind: "createFile"; file: string; value: JsonValue }
    | { kind: "deleteFile"; file: string; was: string }
>;

/**
 * A question an operation can't answer from the files alone. Ask the person, then call `answer`
 * with their choice: it gives the operation's result as if it had been told. A file that can't
 * hold the change is asked about again.
 *
 * - `placement`: several files could hold the change; `files` are the ones that could.
 *
 * `path` is the token the question is about, which matters when one operation changes several.
 *
 * @example
 * let edit = setValue(tokens, "color.danger", "#fca5a5", { input: { mode: "dark" } });
 * if (edit.question) edit = edit.question.answer(await askWhichFile(edit.question.files));
 */
export interface Question {
    kind: "placement";
    path: string;
    files: readonly string[];
    answer(file: string): OpResult;
}

/**
 * What an operation returns: the edits, a question, or a refusal with its reason. Test it by its
 * field: `edit.question`, `edit.refused`, and otherwise `edit.ops` are the edits.
 *
 * @example
 * const edit = rename(tokens, "color.brand", "primary");
 * if (edit.refused) return showWhy(edit.refused.reason);
 */
export type OpResult =
    | {
          ops: readonly FileOp[];
          /**
           * The permutations, other than the one edited, where the change shows, labelled
           * (`alsoAffects.label`, such as `"mode: dark"`). Only permutations the read built are
           * listed, so a read limited by `inputs` lists only those.
           */
          alsoAffects: Permutations;
          /**
           * The tokens and groups left referring to nothing, after a {@link remove}, a
           * {@link rename} of a token generated tokens refer to, or a {@link combine} holding one.
           */
          broken?: readonly string[];
          /** Tokens and groups whose path changed, such as after a {@link rename}. Empty when none did. */
          moved: readonly Move[];
          question?: undefined;
          refused?: undefined;
      }
    | { question: Question; ops?: undefined; refused?: undefined }
    | { refused: Refusal; ops?: undefined; question?: undefined };

/**
 * Why an operation can't be done: a `kind`, the facts it is about, and a `reason` worded from
 * them, so a tool can show the reason or word its own from the facts.
 *
 * - `not-found`: no token or group at `path`.
 * - `not-a-group`: `path` is a token, so nothing can be made inside it.
 * - `taken`: a token or group is already at `path`.
 * - `override-instead`: the token at `path` is shared, so `input` gets its own value by changing
 *   it for that context ({@link setValue}), not by making it again.
 * - `invalid-name`: `name` can't be a name: `character` is the one the spec forbids (Format
 *   5.1.1). An empty name has none: the spec doesn't forbid it, but leaves it unclear.
 * - `generated`: a generator makes the token, from the extension at `extension` on the group at
 *   `from` (absent for the top level of a file).
 * - `inherited`: the token or group comes from the group at `from`, through `$extends`.
 * - `no-permutation`: there is no permutation for `input`; `why` says whether a modifier or
 *   context isn't declared, a context isn't a string, a modifier with no default was left out, or
 *   the read didn't build it.
 * - `several-contexts`: `input` names more than one context away from its default; no file is
 *   read by that combination alone.
 * - `no-file-for-context`: the context `input` names reads no whole file of its own to hold the
 *   edit.
 * - `no-shared-file`: no whole file every permutation reads can hold the edit.
 * - `hidden-by-later-file`: an override for `input` would be hidden by `file`, read after it.
 * - `no-shared-value`: no file every permutation reads writes the token; only contexts do.
 * - `not-written-there`: `at` is not a place the token at `path` is written in these design
 *   tokens, such as a place from an older read.
 * - `gone-elsewhere`: a {@link Clash} can't be settled by keeping yours: what your step changes,
 *   the token or group at `path` in `file`, was removed or renamed since. In a file, a rename
 *   and a removal look the same, so yours isn't written over something else.
 * - `part-in-reference`: on the way to `part`, the value refers to another token, so that part
 *   isn't written there to change.
 * - `no-such-part`: the value written has nowhere to put `part`: a step goes into a value that
 *   isn't an object or a list, or into a list at anything but the index of an item in it.
 */
export type Refusal = { reason: string } & (
    | { kind: "not-found"; path: string }
    | { kind: "not-a-group"; path: string }
    | { kind: "taken"; path: string }
    | { kind: "override-instead"; path: string; input: Input }
    | { kind: "invalid-name"; name: string; character?: "$" | "." | "{" | "}" }
    | { kind: "generated"; path: string; from?: string; extension: readonly [string, ...string[]] }
    | { kind: "inherited"; path: string; from: string }
    | {
          kind: "no-permutation";
          input: Input;
          why: PermutationErrorDetail["reason"];
      }
    | { kind: "several-contexts"; input: Input }
    | { kind: "no-file-for-context"; path: string; input: Input }
    | { kind: "no-shared-file"; path: string }
    | { kind: "hidden-by-later-file"; path: string; input: Input; file: string }
    | { kind: "no-shared-value"; path: string }
    | { kind: "not-written-there"; path: string; at: Pick<Span, "file" | "offset" | "length"> }
    | { kind: "gone-elsewhere"; path?: string; file: string }
    | { kind: "part-in-reference"; path: string; part: JsonPath }
    | { kind: "no-such-part"; path: string; part: JsonPath }
);

/** Where an edit goes. */
export interface Where {
    /**
     * The context the edit is for, as an input such as `{ mode: "dark" }`. Modifiers at their
     * default are ignored, so a permutation's full input can be passed as it is. Naming two
     * non-default contexts is refused: no file is read only by that combination.
     * @default the base value, which every permutation shares
     */
    input?: Input;
}

/** A new token, as it will be written into the file. */
export interface NewToken {
    /**
     * Its type. Leave it out when the group declares one, or when the value is a reference: the
     * token then takes its type from there, as the spec allows. Written as given either way: when
     * no type can be worked out, the read reports it.
     */
    $type?: TokenType;
    /** Written exactly as given. */
    $value: JsonValue;
    $description?: string;
}

export { rename } from "./rename.js";

export { setDescription, setValue } from "./set-value.js";

/** A context a token can be given its own value for, as {@link overridable} lists it. */
export interface Overridable {
    /** The input {@link setValue} writes the override with, such as `{ mode: "dark" }`. */
    input: Input;
    /** The context as a permutation's label words it, such as `"mode: dark"`. */
    label: string;
}

export { overridable } from "./overridable.js";

/** Where an edit goes: for a context, or at one place the token or group is written. */
export type PlaceOptions = (Where & { at?: undefined }) | PlaceAt;

/**
 * How a value change is made: for a context or at a place the token is written, and which part of
 * the value it changes.
 */
export type ValueOptions = PlaceOptions & {
    /**
     * A part of the value to change on its own, such as `["color"]` of a shadow or
     * `[1, "color"]` of its second layer, leaving every other part as written. A member the value
     * doesn't write yet, such as a shadow's `inset`, is added. A new override is the value in
     * force for that context with the part changed.
     */
    part?: JsonPath;
};

/** An edit at one place the token or group is written, rather than for a context. */
export interface PlaceAt {
    /**
     * A place the token or group is written, as `tokens.writtenAt(path)` gives it: what is written
     * there changes, in every permutation that reads it. No file is chosen and nothing is asked.
     */
    at: Pick<Span, "file" | "offset" | "length">;
    input?: undefined;
}

/**
 * Changes several values in one step, checked with one read, so a change that spans many tokens,
 * such as switching a palette, is accepted or refused as a whole. Each value follows the rules of
 * {@link setValue}.
 *
 * @example
 * setValues(tokens, [
 *   { path: "color.button.background", value: "{color.violet.500}" },
 *   { path: "color.button.background", value: "{color.violet.300}", input: { mode: "dark" } },
 * ])
 */
export function setValues(
    tokens: DesignTokens,
    values: readonly ({ path: string; value: JsonValue } & ValueOptions)[],
): OpResult {
    throw new Error("not implemented yet");
}

export { create } from "./create.js";

/** Moves a token or group among its siblings. */
export function reorder(
    tokens: DesignTokens,
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
 * move(tokens, "color.brand.500", { group: "color.primary", name: "600" })
 */
export function move(
    tokens: DesignTokens,
    path: string,
    to: { group?: string; file?: string; name?: string },
): OpResult {
    throw new Error("not implemented yet");
}

export { remove } from "./remove.js";

export { deprecate } from "./deprecate.js";

export { setExtension } from "./set-extension.js";

/**
 * Turns fixes offered for these design tokens' diagnostics into ordinary edits, so they can be
 * undone, saved and replayed like any other. Pass several to make them one step. Every fix must
 * come from {@link fixesFor} for these design tokens.
 *
 * @example
 * const safe = tokens.diagnostics.flatMap((d) => fixesFor(tokens, d).filter((f) => f.safe));
 * commit(tokens, fix(tokens, safe));
 */
export function fix(tokens: DesignTokens, fixes: readonly Fix[]): OpResult {
    throw new Error("not implemented yet");
}

/** Changes a token's type. Refused if tokens that refer to it would break. */
export function retype(tokens: DesignTokens, path: string, type: TokenType): OpResult {
    throw new Error("not implemented yet");
}

/** Turns a token made by a generator into an ordinary token written in the file. */
export function detach(tokens: DesignTokens, path: string): OpResult {
    throw new Error("not implemented yet");
}

/** Adds a file to a set or to a modifier's context in the resolver. */
export function addFile(
    tokens: DesignTokens,
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
 * addContext(tokens, "theme", "dim", { file: "dim.json", basedOn: "dark" })
 */
export function addContext(
    tokens: DesignTokens,
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
    tokens: DesignTokens,
    modifier: string,
    options: { contexts: readonly string[]; default?: string },
): OpResult {
    throw new Error("not implemented yet");
}

/** Renames a modifier's context. */
export function renameContext(
    tokens: DesignTokens,
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
    tokens: DesignTokens,
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
export function setDefault(tokens: DesignTokens, modifier: string, context: string): OpResult {
    throw new Error("not implemented yet");
}

/**
 * An edit that could no longer be made, such as a change to a token someone has since deleted,
 * with a `reason` worded from its `kind` and the edit.
 *
 * - `not-read`: the design tokens aren't read from the edit's file: an edit to a file never read,
 *   such as `package.json`, or a new file nothing would read, which would be lost.
 * - `gone`: the place the edit changes is no longer there.
 * - `changed`: what is there is no longer what the edit expected (`was`).
 * - `taken`: something different is already where the edit would write, or a sibling already
 *   has the new name.
 * - `not-a-group`: the `jsonPath` runs through something that isn't a group, or past the end of a
 *   list.
 */
export interface Conflict {
    op: FileOp;
    kind: "not-read" | "gone" | "changed" | "taken" | "not-a-group";
    reason: string;
}

export { apply, changedFiles, commit } from "./apply.js";

export { combine } from "./combine.js";

/**
 * An operation for {@link combine}: given the design tokens the operations before it leave, it
 * makes its edit from them, as `(current) => remove(current, path)` does.
 */
export type Operation = (tokens: DesignTokens) => OpResult;

/**
 * The outcome of {@link apply}. Test it by its field: `next.tokens`, or `next.conflicts`.
 */
export type Applied =
    | {
          /** The design tokens with the edits applied. */
          tokens: DesignTokens;
          conflicts?: undefined;
      }
    | { conflicts: Conflict[]; tokens?: undefined };

/**
 * The outcome of {@link commit}. Test it by its field: `done.tokens`, `done.question`,
 * `done.refused` or `done.conflicts`.
 */
export type Committed =
    | {
          /** The design tokens with the edits applied. */
          tokens: DesignTokens;
          /** The edits that were applied, for undo, saving, and sharing. */
          ops: readonly FileOp[];
          /** Tokens and groups whose path changed, for keeping a selection or a URL on them. */
          moved: readonly Move[];
          question?: undefined;
          refused?: undefined;
          conflicts?: undefined;
      }
    | { question: Question; tokens?: undefined; refused?: undefined; conflicts?: undefined }
    | { refused: Refusal; tokens?: undefined; question?: undefined; conflicts?: undefined }
    | { conflicts: Conflict[]; tokens?: undefined; question?: undefined; refused?: undefined };

/**
 * One thing done in a session: the edits of one operation, with the moves it made, kept or dropped
 * together. A rename that changes several files is one step, so it is never half kept.
 */
export interface EditStep {
    readonly ops: readonly FileOp[];
    readonly moved: readonly Move[];
}

/**
 * Edits as a session keeps them: one {@link EditStep} for each operation done, in order. What a
 * save writes, all or nothing, and what a reload puts back, each step whole or not at all.
 */
export interface Edits {
    readonly steps: readonly EditStep[];
}

export { isEdits } from "./is-edits.js";

/**
 * An unsaved {@link EditStep} that no longer fits the files, left out whole: someone else changed
 * or removed what it changes, or its file is gone. One per step, however many files it changes.
 */
export interface Clash {
    /** The step left out, as it was done: its edits, and the moves it made. */
    readonly step: EditStep;
    /** Each part of a file the step changes, such as a token, a group or the resolver's list of sources. */
    readonly parts: readonly ClashPart[];
    /**
     * Whether {@link keepYours} can write yours over theirs: every part the step changes is still
     * there in the files. Not when one was removed or renamed since, or its file is gone.
     */
    readonly keepable: boolean;
}

/** One part of a file an unsaved step changes, with your side and theirs. */
export interface ClashPart {
    /** The file the edits change. */
    readonly file: string;
    /** Where in the file: its route through the file's JSON; `[]` for the whole file. */
    readonly jsonPath: JsonPath;
    /** The token or group at `jsonPath`, when one is there. */
    readonly path?: string;
    /** What the edits write for it there, put on top of the file as it is now; absent when they remove it. */
    readonly yours?: JsonValue;
    /** What the file has for it now; absent when it isn't there, or the file is gone. */
    readonly theirs?: JsonValue;
}

/** How {@link Session.do} keeps an edit among the steps undo takes back. */
export interface StepOptions {
    /**
     * The field the edit comes from, such as `"value color.brand"`: edits given the same `merge`
     * one after another are one step.
     */
    readonly merge?: string;
}

/**
 * An editing session: design tokens as a person edits them, with undo, the unsaved edits, and
 * what changed since they were opened. It changes as it is used, like a store; the design tokens in
 * it never do. Writing is left to the tool: send {@link Session.unsaved} wherever saves go, then
 * call {@link Session.markSaved}.
 *
 * @example
 * const session = createSession(tokens);
 * session.do(rename(session.tokens, "color.brand", "primary"));
 * session.undo();
 */
export interface Session {
    /** The current version. */
    readonly tokens: DesignTokens;
    /**
     * The version the unsaved edits are measured from: as opened, as last saved, or as last
     * rebased onto.
     */
    readonly opened: DesignTokens;
    /** The edits since {@link Session.opened}, with the moves they made: what a save sends, and what to keep for a reload. */
    readonly unsaved: Edits;
    /** Whether there is an unsaved step to undo. */
    readonly canUndo: boolean;
    /** Whether there is an undone step to do again. */
    readonly canRedo: boolean;
    /**
     * Commits an operation's result. On success the design tokens move on, the change is a new
     * unsaved step, and nothing undone can be done again; otherwise nothing changes, and the
     * answer says why.
     *
     * Edits given the same `merge` one after another are one step, undone as one, such as every
     * move of a slider for one value. Several edits to one place in a file are kept as one, and a
     * step whose edits come back to where it started is dropped, the design tokens going back to
     * those before it. Anything else ends the step: an edit with another `merge` or none, undo,
     * redo, a save, a discard, a reload, a change on disk, or {@link Session.endStep}.
     *
     * @example
     * session.do(setValue(session.tokens, "color.brand", next), { merge: "value color.brand" });
     */
    do(result: OpResult, options?: StepOptions): Committed;
    /**
     * Ends the step edits are being merged into, so the next edit is a step of its own even with
     * the same `merge`. Call it when a save starts, since the session can't see that, so the step
     * being sent doesn't change under it.
     */
    endStep(): void;
    /** Commits an operation's result without keeping it, for previewing, such as while a slider moves. */
    preview(result: OpResult): Committed;
    /**
     * Takes back the last unsaved step, whole, going back to the design tokens before it and the
     * ids they had. Undo stops at a save: with nothing unsaved, nothing happens.
     */
    undo(): void;
    /** Does again the last step undone, as the same step. Nothing happens when there is none. */
    redo(): void;
    /** What changed since {@link Session.opened}, renames included. */
    changes(): readonly Change[];
    /**
     * Records that the unsaved edits were saved: the current version becomes
     * {@link Session.opened}. Undo stops here: what was saved can't be undone, and what was undone
     * before the save can't be done again.
     *
     * Given the edits a save sent, as {@link Session.unsaved} was when it began, only those count
     * as saved: anything done while the save was on its way stays unsaved, measured from them.
     * Nothing counts as saved when the session no longer holds them, such as after a discard.
     *
     * @example
     * const sent = session.unsaved;
     * await save(sent);
     * session.markSaved(sent);
     */
    markSaved(saved?: Edits): void;
    /** Goes back to {@link Session.opened} and drops the unsaved edits, so there is nothing to undo or redo. */
    discard(): void;
    /**
     * Puts back unsaved edits kept from before a reload, such as in session storage, on top
     * of the current version, where they are unsaved again; {@link Session.discard} still goes
     * back to {@link Session.opened}. Each {@link EditStep} whose edits all still fit is put back
     * whole; a step with one that doesn't is left out whole, so a rename is never half kept, and
     * comes back as one {@link Clash}, holding each part of a file it changes. The steps put back
     * can be undone one at a time; nothing undone before can be done again.
     */
    restore(unsaved: Edits): Clash[];
    /**
     * Takes in files that changed underneath the session, such as after a `git pull`: `fresh`
     * becomes {@link Session.opened}, and each unsaved {@link EditStep} whose edits all still fit is
     * put back on top of it, whole; a step with one that doesn't is left out whole, and comes back as
     * one {@link Clash}, holding each part of a file it changes, the files showing theirs. A
     * token still there keeps its id, one gone loses it, and a new one gets a new id. The steps
     * put back can still be undone; nothing undone before can be done again.
     */
    rebase(fresh: DesignTokens): Clash[];
    /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
    subscribe(listener: () => void): () => void;
    /**
     * The id of the token or group at `path`, for a screen to hold in place of the path, so a
     * selection or a URL stays on it through renames. A token or group has its path when opened as
     * its id, and one made in the session an id starting `new:`, so it never takes the id of one
     * renamed away from its path. A removed one's id is forgotten. `undefined` when nothing is at
     * `path`.
     *
     * @example
     * const id = session.idOf("color.brand");
     * session.do(rename(session.tokens, "color.brand", "primary"));
     * session.pathOf(id); // "color.primary"
     */
    idOf(path: string): string | undefined;
    /** Where the token or group with this id is now, or `undefined` once it is removed. */
    pathOf(id: string): string | undefined;
}

export { createSession } from "./session.js";

export { keepYours } from "./keep-yours.js";
