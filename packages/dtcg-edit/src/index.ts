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
import { exceptionMessages } from "./error-messages.js";

/**
 * A replacement of text in one file.
 *
 * Offsets and lengths count UTF-16 code units, as a `Span` in `@sugarcube-sh/dtcg` does.
 */
export interface TextEdit {
    /** The file, such as `"color.json"`. */
    file: string;
    /** Where the text to replace starts. */
    offset: number;
    /** How long the text to replace is. It's `0` for an insertion. */
    length: number;
    /** The new text. */
    text: string;
}

/** A change that would mend a diagnostic, from {@link getFixes}. */
export interface Fix {
    /** What the fix does, such as "use `color.primary`, which has a similar name". */
    title: string;
    /**
     * Whether it's safe to apply without asking a person.
     *
     * A safe fix mends the problem and changes nothing else the files mean. A fix that isn't safe
     * is a likely guess, such as a similar name.
     */
    isSafe: boolean;
    /** The text to replace. */
    edits: readonly TextEdit[];
}

export { getFixes } from "./fixes.js";

/**
 * One change to one file's JSON.
 *
 * It finds its place by `jsonPath`, so it still applies after other changes to the file.
 *
 * - `set` - changes a value that exists. Its parent must exist.
 * - `add` - adds a value, making any missing groups. Nothing must be there yet.
 * - `remove` - removes a value. Nothing happens if it's already gone.
 * - `rename-key` - renames a key, keeping its value and position.
 * - `create-file` - creates a file containing `value`. The file must not exist yet.
 * - `delete-file` - deletes a file.
 *
 * `was` is what the edit expects to find. If the file has changed there since, the edit is a
 * {@link Conflict}. For `rename-key`, `was` only tells whether the rename is already done.
 *
 * @example
 * // The shared value of color.primary, in color.json
 * setValue(tokens, "color.primary", "{color.blue.300}").ops
 * // => [{ kind: "set", file: "color.json", jsonPath: ["color", "primary", "$value"],
 * //       value: "{color.blue.300}", was: "{color.blue.500}" }]
 */
export type FileOp = Readonly<
    | { kind: "set"; file: string; jsonPath: JsonPath; value: JsonValue; was: JsonValue }
    | { kind: "add"; file: string; jsonPath: JsonPath; value: JsonValue }
    | { kind: "remove"; file: string; jsonPath: JsonPath; was: JsonValue }
    | { kind: "rename-key"; file: string; jsonPath: JsonPath; name: string; was: JsonValue }
    | { kind: "create-file"; file: string; value: JsonValue }
    | { kind: "delete-file"; file: string; was: string }
>;

/**
 * A choice an operation needs a person to make.
 *
 * Ask which of `files` to use, then pass it to `answer`. If the file can't take the change, the
 * result is the question again.
 *
 * @example
 * // dark reads dark.json and dark-brand.json, and neither writes button.background
 * const { question } = setValue(tokens, "button.background", "{color.blue.300}", {
 *     input: { mode: "dark" },
 * });
 * question?.files
 * // => ["dark.json", "dark-brand.json"]
 */
export interface Question {
    /** What is asked. `"placement"` asks which file a change goes in. */
    kind: "placement";
    /** The token the question is about, such as `"button.background"`. */
    path: string;
    /** The files to choose from. */
    files: readonly string[];
    /**
     * Carries on with the chosen file.
     *
     * @param file - One of `files`, such as `"dark-brand.json"`.
     *
     * @example
     * // Put dark's button.background in dark-brand.json
     * question.answer("dark-brand.json").ops
     * // => [{ kind: "add", file: "dark-brand.json", jsonPath: ["button", "background"],
     * //       value: { $type: "color", $value: "{color.blue.300}" } }]
     */
    answer(file: string): OperationResult;
}

/**
 * What an operation returns.
 *
 * It has `ops` when it worked, `question` when it needs a choice, or `refusal` when it can't be
 * done.
 *
 * @example
 * // color.blue is already a group
 * rename(tokens, "color.primary", "blue").refusal?.kind
 * // => "taken"
 */
export type OperationResult =
    | {
          /** The edits, for {@link commit} or {@link Session.do}. */
          ops: readonly FileOp[];
          /**
           * The other permutations the change shows in, such as `mode: dark`.
           *
           * Permutations this read didn't build aren't included.
           */
          affectedPermutations: Permutations;
          /**
           * Tokens and groups left with references to nothing.
           *
           * Set by {@link remove}, {@link rename} and {@link combine}.
           */
          pathsWithBrokenReferences?: readonly string[];
          /** Tokens and groups whose path changed, such as after a {@link rename}. */
          moves: readonly Move[];
          question?: undefined;
          refusal?: undefined;
      }
    | {
          /** The choice to ask a person to make. */
          question: Question;
          ops?: undefined;
          refusal?: undefined;
      }
    | {
          /** Why it can't be done. */
          refusal: Refusal;
          ops?: undefined;
          question?: undefined;
      };

/**
 * Why an operation can't be done.
 *
 * `reason` is a sentence to show. The other fields depend on `kind`.
 *
 * - `not-found` - nothing is at `path`.
 * - `top-level` - the path is `""`, the top level of a file. It can't be renamed or removed.
 * - `not-a-group` - `path` is a token, so nothing can go inside it.
 * - `taken` - something is already at `path`.
 * - `override-instead` - the token is shared. Change it for `input` with {@link setValue}.
 * - `invalid-name` - `character` can't be in a name. It's absent for an empty name.
 * - `generated` - a generator makes the token, from `extension` on the group `from`.
 * - `inherited` - the token or group comes from the group `from`, through `$extends`.
 * - `no-permutation` - there is no permutation for `input`. `cause` says why.
 * - `several-contexts` - `input` names two contexts away from their defaults.
 * - `no-file-for-context` - no whole file is read by that context alone.
 * - `no-shared-file` - no whole file is read by every permutation.
 * - `hidden-by-later-file` - `file` is read later, so it would hide the override.
 * - `no-shared-value` - only contexts write the token, so there's no shared value.
 * - `not-a-definition` - `at` isn't one of the token's definitions, such as one from an older read.
 * - `removed-since` - what your step changes in `file` was removed or renamed since.
 * - `part-in-reference` - the value refers to another token on the way to `part`.
 * - `no-such-part` - the value has nowhere to put `part`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
 *
 * @example
 * // color.primary already exists
 * create(tokens, "color.primary", { $value: "{color.blue.300}" }).refusal
 * // => { kind: "taken", path: "color.primary", reason: "`color.primary` already exists" }
 */
export type Refusal = {
    /** A sentence to show, such as "`color.primary` already exists". */
    reason: string;
} & (
    | { kind: "not-found"; path: string }
    | { kind: "top-level" }
    | { kind: "not-a-group"; path: string }
    | { kind: "taken"; path: string }
    | { kind: "override-instead"; path: string; input: Input }
    | { kind: "invalid-name"; name: string; character?: "$" | "." | "{" | "}" }
    | { kind: "generated"; path: string; from: string; extension: readonly [string, ...string[]] }
    | { kind: "inherited"; path: string; from: string }
    | {
          kind: "no-permutation";
          input: Input;
          cause: PermutationErrorDetail["reason"];
      }
    | { kind: "several-contexts"; input: Input }
    | { kind: "no-file-for-context"; path: string; input: Input }
    | { kind: "no-shared-file"; path: string }
    | { kind: "hidden-by-later-file"; path: string; input: Input; file: string }
    | { kind: "no-shared-value"; path: string }
    | { kind: "not-a-definition"; path: string; at: Pick<Span, "file" | "offset" | "length"> }
    | { kind: "removed-since"; path?: string; file: string }
    | { kind: "part-in-reference"; path: string; part: JsonPath }
    | { kind: "no-such-part"; path: string; part: JsonPath }
);

/** Options for an edit to one context. */
export interface ContextOptions {
    /**
     * The context the edit is for, such as `{ mode: "dark" }`.
     *
     * Modifiers at their default are ignored, so a permutation's whole input works.
     *
     * @default the shared value, which every permutation reads
     */
    input?: Input;
}

/** A token to create. It's written to the file as passed. */
export interface NewToken {
    /**
     * The token's type, such as `"color"`.
     *
     * Leave it out when its group or a reference sets it. If nothing sets a type, the read
     * reports it.
     */
    $type?: TokenType;
    /** The token's value, such as `"{color.blue.300}"`. */
    $value: JsonValue;
    /** The token's description. */
    $description?: string;
}

export { rename } from "./rename.js";

export { setDescription, setValue } from "./set-value.js";

/** A context a token can have its own value in, from {@link getOverridableContexts}. */
export interface OverridableContext {
    /** The input to pass to {@link setValue}, such as `{ mode: "dark" }`. */
    input: Input;
    /** The context's label, such as `"mode: dark"`. */
    label: string;
}

export { getOverridableContexts } from "./overridable.js";

/**
 * Where an edit goes.
 *
 * It's for one context, with {@link ContextOptions}, or at one definition, with
 * {@link DefinitionOptions}.
 */
export type EditOptions = (ContextOptions & { at?: undefined }) | DefinitionOptions;

/**
 * Options for a value change.
 *
 * They say where it goes, as {@link EditOptions} do, and which part of the value changes.
 */
export type ValueOptions = EditOptions & {
    /**
     * The part of a composite value to change, such as `["color"]` of a shadow.
     *
     * Every other part stays as written. A part the value doesn't write yet is added. A new
     * override copies the context's current value, with the part changed.
     *
     * @default the whole value
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#composite-types | Format 9, Composite types}
     */
    part?: JsonPath;
};

/** Options for an edit at one definition of a token or group. */
export interface DefinitionOptions {
    /**
     * The definition's span, from `tokens.getDefinitions(path)`.
     *
     * The change shows in every permutation that reads it. No file is chosen, and nothing is asked.
     */
    at: Pick<Span, "file" | "offset" | "length">;
    input?: undefined;
}

/**
 * Changes several values in one step.
 *
 * The changes are made, or refused, together. Each one works as {@link setValue} does.
 *
 * @param tokens - The design tokens to edit.
 * @param values - Each token's path and new value, with {@link ValueOptions}.
 */
export function setValues(
    tokens: DesignTokens,
    values: readonly ({ path: string; value: JsonValue } & ValueOptions)[],
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

export { create } from "./create.js";

/**
 * Moves a token or group among its siblings.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.blue.300"`.
 * @param options - The sibling to go after or before, such as `{ before: "color.blue.500" }`.
 */
export function reorder(
    tokens: DesignTokens,
    path: string,
    options: { after: string } | { before: string },
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Moves a token or group to another group or file.
 *
 * Refused when the new file is read by different contexts than the old one.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.blue.300"`.
 * @param to - Where it goes, such as `{ group: "color.brand" }`.
 */
export function move(
    tokens: DesignTokens,
    path: string,
    to: {
        /** The group to move it into. */
        group?: string;
        /** The file to move it into. */
        file?: string;
        /** Its new name. */
        name?: string;
    },
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

export { remove } from "./remove.js";

export { deprecate } from "./deprecate.js";

export { setExtension } from "./set-extension.js";

/**
 * Turns fixes into edits.
 *
 * The edits can be undone, saved and replayed like any other. Several fixes make one step.
 *
 * @param tokens - The design tokens the fixes are for.
 * @param fixes - Fixes from {@link getFixes} for these design tokens.
 */
export function fix(tokens: DesignTokens, fixes: readonly Fix[]): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Changes a token's type.
 *
 * Refused if tokens that refer to it would break.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token, such as `"color.primary"`.
 * @param type - The new `$type`, such as `"color"`.
 */
export function setType(tokens: DesignTokens, path: string, type: TokenType): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Turns a generated token into one written in a file.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token a generator makes, such as `"color.blue.500"`.
 */
export function detach(tokens: DesignTokens, path: string): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Adds a file to a set or a context in the resolver.
 *
 * @param tokens - The design tokens to edit.
 * @param file - The file, such as `"brand.json"`.
 * @param options - Where it goes.
 */
export function addFile(
    tokens: DesignTokens,
    file: string,
    options: {
        /** The set or context to add it to, such as `{ modifier: "mode", context: "dark" }`. */
        to: { set: string } | { modifier: string; context: string };
        /**
         * The source to place it after.
         * @default the end
         */
        after?: string;
    },
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Adds a context to a modifier.
 *
 * The context gets a new file of its own.
 *
 * @param tokens - The design tokens to edit.
 * @param modifier - The modifier, such as `"mode"`.
 * @param context - The new context's name, such as `"dim"`.
 * @param options - Its file, and a context to build on.
 */
export function addContext(
    tokens: DesignTokens,
    modifier: string,
    context: string,
    options: {
        /** The new file, such as `"dim.json"`. */
        file: string;
        /** A context whose files come first, such as `"dark"`. */
        basedOn?: string;
    },
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Adds a modifier to the resolver.
 *
 * @param tokens - The design tokens to edit.
 * @param modifier - The new modifier's name, such as `"contrast"`.
 * @param options - Its contexts and default.
 */
export function addModifier(
    tokens: DesignTokens,
    modifier: string,
    options: {
        /** Its contexts, such as `["normal", "high"]`. */
        contexts: readonly string[];
        /** Its default context, such as `"normal"`. */
        default?: string;
    },
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Renames a modifier's context.
 *
 * @param tokens - The design tokens to edit.
 * @param modifier - The modifier, such as `"mode"`.
 * @param from - The context's name now, such as `"dark"`.
 * @param to - Its new name, such as `"night"`.
 */
export function renameContext(
    tokens: DesignTokens,
    modifier: string,
    from: string,
    to: string,
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Removes a modifier's context.
 *
 * Its files stay on disk unless `deleteFiles` is set. A file another context or set reads is
 * never deleted.
 *
 * @param tokens - The design tokens to edit.
 * @param modifier - The modifier, such as `"mode"`.
 * @param context - The context, such as `"dark"`.
 * @param options - Whether to delete its files.
 */
export function removeContext(
    tokens: DesignTokens,
    modifier: string,
    context: string,
    options?: {
        /**
         * Whether to delete the context's files.
         * @default false
         */
        deleteFiles?: boolean;
    },
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * Sets a modifier's default context.
 *
 * @param tokens - The design tokens to edit.
 * @param modifier - The modifier, such as `"mode"`.
 * @param context - The new default, such as `"dark"`.
 */
export function setDefaultContext(
    tokens: DesignTokens,
    modifier: string,
    context: string,
): OperationResult {
    throw new Error(exceptionMessages.notImplemented);
}

/**
 * An edit that can no longer be made.
 *
 * `reason` is a sentence to show, made from `kind` and the edit.
 *
 * - `not-read` - the edit's file isn't read, such as `package.json`, or a new file nothing reads.
 * - `gone` - the place the edit changes is gone.
 * - `changed` - the value there isn't what the edit expected, its `was`.
 * - `taken` - something else is already where the edit writes, or a sibling has the new name.
 * - `not-a-group` - `jsonPath` goes through something that isn't a group, or past the end of an
 *   array.
 */
export interface Conflict {
    /** The edit. */
    op: FileOp;
    /** What stops it, such as `"changed"`. */
    kind: "not-read" | "gone" | "changed" | "taken" | "not-a-group";
    /**
     * A sentence to show, such as "`color.primary.$value` in `color.json` has changed since the
     * edit was made".
     */
    reason: string;
}

/**
 * What {@link getChangedFiles} returns.
 *
 * It has `textByFile` when the edits apply, or `conflicts` when they don't.
 */
export type ChangedFiles =
    | {
          /** The design tokens as read from the new text. */
          tokens: DesignTokens;
          /** The new text of each file the edits change or create. */
          textByFile: Record<string, string>;
          /** The files the edits delete. */
          deleted: string[];
          conflicts?: undefined;
      }
    | {
          /** The edits that can no longer be made. */
          conflicts: Conflict[];
          tokens?: undefined;
      };

export { apply, getChangedFiles, commit } from "./apply.js";

export { combine } from "./combine.js";

/**
 * An operation for {@link combine}, such as `(current) => remove(current, path)`.
 *
 * It's passed the design tokens the operations before it leave.
 */
export type Operation = (tokens: DesignTokens) => OperationResult;

/**
 * What {@link apply} returns.
 *
 * It has `tokens` when the edits apply, or `conflicts` when they don't.
 */
export type ApplyResult =
    | {
          /** The design tokens with the edits applied. */
          tokens: DesignTokens;
          conflicts?: undefined;
      }
    | {
          /** The edits that can no longer be made. */
          conflicts: Conflict[];
          tokens?: undefined;
      };

/**
 * What {@link commit} and {@link Session.do} return.
 *
 * It has `tokens` when it worked. Otherwise it has `question`, `refusal` or `conflicts`.
 */
export type CommitResult =
    | {
          /** The design tokens with the edits applied. */
          tokens: DesignTokens;
          /** The edits applied. */
          ops: readonly FileOp[];
          /** Tokens and groups whose path changed. */
          moves: readonly Move[];
          question?: undefined;
          refusal?: undefined;
          conflicts?: undefined;
      }
    | {
          /** The choice to ask a person to make. */
          question: Question;
          tokens?: undefined;
          refusal?: undefined;
          conflicts?: undefined;
      }
    | {
          /** Why it can't be done. */
          refusal: Refusal;
          tokens?: undefined;
          question?: undefined;
          conflicts?: undefined;
      }
    | {
          /** The edits that can no longer be made. */
          conflicts: Conflict[];
          tokens?: undefined;
          question?: undefined;
          refusal?: undefined;
      };

/**
 * One operation's edits in a session.
 *
 * They're kept or dropped together. A rename that changes several files is one step.
 */
export interface EditStep {
    /** The edits. */
    readonly ops: readonly FileOp[];
    /** Tokens and groups whose path changed. */
    readonly moves: readonly Move[];
}

/**
 * The edits a session keeps, one {@link EditStep} per operation.
 *
 * A save writes them all or none. A reload puts back each step whole, or not at all.
 */
export interface Edits {
    /** The steps in the order they were done. */
    readonly steps: readonly EditStep[];
}

export { isEdits } from "./is-edits.js";

/**
 * An unsaved step that no longer fits the files.
 *
 * Someone else changed or removed what it changes, or deleted its file. The step is left out
 * whole.
 *
 * @example
 * // You set color.primary to {color.blue.300}. A pull changed it in color.json.
 * session.rebase(fresh)[0].parts
 * // => [{ file: "color.json", jsonPath: ["color", "primary"], path: "color.primary",
 * //       yours: { $type: "color", $value: "{color.blue.300}" },
 * //       theirs: { $type: "color", $value: { colorSpace: "srgb", components: [0.2, 0.4, 1] } } }]
 */
export interface Clash {
    /** The step left out. */
    readonly step: EditStep;
    /** Each part of a file the step changes, such as a token or a group. */
    readonly parts: readonly ClashPart[];
    /**
     * Whether {@link keepYours} can settle it.
     *
     * It's `false` when a part was removed or renamed since, or its file is gone.
     */
    readonly canKeepYours: boolean;
}

/** One part of a file that a clashing step changes. */
export interface ClashPart {
    /** The file, such as `"color.json"`. */
    readonly file: string;
    /** Where in the file, such as `["color", "primary"]`. It's `[]` for the whole file. */
    readonly jsonPath: JsonPath;
    /** The token or group there, such as `"color.primary"`. */
    readonly path?: string;
    /** What your step writes there. It's absent when your step removes it. */
    readonly yours?: JsonValue;
    /** What the file has there now. It's absent when nothing is there. */
    readonly theirs?: JsonValue;
}

/** Options for how {@link Session.do} groups edits into steps. */
export interface StepOptions {
    /**
     * A key for merging edits into one step, such as `"value color.primary"`.
     *
     * Edits in a row with the same key are one step.
     */
    readonly mergeKey?: string;
}

/**
 * An editing session that keeps unsaved edits and undo.
 *
 * The session changes as it's used. The design tokens in it never do. To save, send
 * {@link Session.unsavedEdits}, then call {@link Session.markSaved}.
 *
 * @example
 * // Undo a rename
 * const session = createSession(tokens);
 * session.do(rename(session.tokens, "color.primary", "brand"));
 * session.undo();
 * session.canUndo
 * // => false
 */
export interface Session {
    /** The design tokens as they are now. */
    readonly tokens: DesignTokens;
    /**
     * The design tokens the unsaved edits start from.
     *
     * They're the tokens as opened, last saved, or last rebased.
     */
    readonly savedTokens: DesignTokens;
    /**
     * The edits since {@link Session.savedTokens}.
     *
     * Send them to save, or keep them for a reload.
     */
    readonly unsavedEdits: Edits;
    /** Whether there's an unsaved step to undo. */
    readonly canUndo: boolean;
    /** Whether there's an undone step to redo. */
    readonly canRedo: boolean;
    /**
     * Commits an operation's result as a new step.
     *
     * A question or a refusal changes nothing and is returned as it is. Nothing undone can be redone
     * after it. A step that ends where it started is dropped.
     *
     * @param result - An operation's result, such as from {@link setValue}.
     * @param options - How to group it into steps.
     *
     * @example
     * // Two changes from one field are one step
     * session.do(setValue(session.tokens, "color.blue.500", first), { mergeKey: "value color.blue.500" });
     * session.do(setValue(session.tokens, "color.blue.500", second), { mergeKey: "value color.blue.500" });
     * session.unsavedEdits.steps.length
     * // => 1
     */
    do(result: OperationResult, options?: StepOptions): CommitResult;
    /**
     * Ends the step edits are merging into.
     *
     * Call it when a save starts, so the step being sent doesn't change.
     */
    endStep(): void;
    /**
     * Commits an operation's result without keeping it.
     *
     * @param result - An operation's result, such as from {@link setValue}.
     */
    preview(result: OperationResult): CommitResult;
    /**
     * Undoes the last unsaved step.
     *
     * The design tokens and IDs go back to what they were before it. Undo stops at the last save.
     */
    undo(): void;
    /** Redoes the last undone step. Nothing happens when there is none. */
    redo(): void;
    /**
     * Lists what changed since {@link Session.savedTokens}, renames included.
     *
     * @example
     * // After renaming color.primary to color.brand, in light and in dark
     * session.getChanges().map((change) => change.kind)
     * // => ["renamed", "renamed"]
     */
    getChanges(): readonly Change[];
    /**
     * Records that the unsaved edits were saved.
     *
     * The current design tokens become {@link Session.savedTokens}. Undo stops here.
     *
     * @param sent - {@link Session.unsavedEdits} as it was when the save began, so later edits
     *   stay unsaved. Left out, every unsaved edit counts as saved.
     *
     * @example
     * // Save, then mark what was sent as saved
     * const sent = session.unsavedEdits;
     * await save(sent);
     * session.markSaved(sent);
     * session.canUndo
     * // => false
     */
    markSaved(sent?: Edits): void;
    /**
     * Drops the unsaved edits, going back to {@link Session.savedTokens}.
     *
     * Nothing is left to undo or redo.
     */
    discard(): void;
    /**
     * Puts back unsaved edits kept from before a reload.
     *
     * A step that no longer fits is left out whole, and returned as a {@link Clash}.
     *
     * @param edits - Edits kept from {@link Session.unsavedEdits}, such as in session storage.
     *
     * @example
     * // Edits kept from before a reload, which all still fit
     * session.restore(kept)
     * // => []
     */
    restore(edits: Edits): Clash[];
    /**
     * Takes in files that changed underneath the session.
     *
     * `fresh` becomes {@link Session.savedTokens}, with the unsaved steps on top. A step that no
     * longer fits is left out whole, and returned as a {@link Clash}.
     *
     * @param fresh - The design tokens read again, such as after a `git pull`.
     *
     * @example
     * // You set color.primary to {color.blue.300}. A pull changed it in color.json.
     * session.rebase(fresh).map((clash) => clash.canKeepYours)
     * // => [true]
     */
    rebase(fresh: DesignTokens): Clash[];
    /**
     * Calls `listener` whenever the session changes.
     *
     * @param listener - The function to call.
     * @returns A function that stops listening.
     */
    subscribe(listener: () => void): () => void;
    /**
     * Returns the ID of the token or group at `path`.
     *
     * The ID stays the same through renames and rebases.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // Follow color.primary through a rename
     * const id = session.getID("color.primary");
     * session.do(rename(session.tokens, "color.primary", "brand"));
     * session.getPath(id)
     * // => "color.brand"
     */
    getID(path: string): string | undefined;
    /**
     * Returns the path of the token or group with this ID.
     *
     * It's `undefined` once the token or group is removed.
     *
     * @param id - An ID from {@link Session.getID}, such as `"color.primary"`.
     */
    getPath(id: string): string | undefined;
}

export { createSession } from "./session.js";

export { keepYours } from "./keep-yours.js";
