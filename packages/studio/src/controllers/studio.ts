import {
    type Change,
    type DesignTokens,
    type Group,
    type Input,
    type Permutation,
    type Token,
    readFromMemory,
    isEqualJson,
} from "@sugarcube-sh/dtcg";
import {
    type Clash,
    type CommitResult,
    type Edits,
    type OperationResult,
    type DefinitionOptions,
    type StepOptions,
    createSession,
    keepYours,
} from "@sugarcube-sh/dtcg-edit";
import type { SaveResult, MessageAdapter, StudioMessage, StudioSave } from "../protocol";
import type { BuildAdapter, BuildOutput, BuildProblem, ExtensionForm } from "./adapter";
import { type KeyedValue, getValueForKey } from "./keyed-value";
import { formatSaveError } from "./views";

export type SaveStatus = SaveResult | { readonly failed: string };

export interface StudioState {
    readonly tokens: DesignTokens;
    readonly shownPermutation: Permutation;
    readonly getValue: BuildOutput["getValue"];
    getForm(node: Token | Group, at?: DefinitionOptions["at"]): ExtensionForm | undefined;
    readonly css: string;
    readonly problems: readonly BuildProblem[];
    readonly changes: readonly Change[];
    readonly clashes: readonly Clash[];
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly saving: boolean;
    readonly saved: SaveStatus | undefined;
}

export interface Studio {
    readonly state: StudioState;
    readonly unsaved: Edits;
    subscribe(listener: () => void): () => void;
    destroy(): void;
    show(input: Input): void;
    receive(message: StudioMessage): void;
    do(result: OperationResult, options?: StepOptions): CommitResult;
    undo(): void;
    redo(): void;
    discard(): void;
    restore(edits: Edits): void;
    resolveClash(clash: Clash, side: "yours" | "theirs"): CommitResult | undefined;
    getID(path: string): string | undefined;
    getPath(id: string): string | undefined;
    save?(): Promise<SaveResult | undefined>;
}

export function createStudio(
    firstMessage: StudioMessage,
    createAdapter: (sent: MessageAdapter) => BuildAdapter,
    saveEdits?: StudioSave,
): Studio {
    let message = firstMessage;
    let adapter = createAdapter(firstMessage.adapter);
    const session = createSession(readTokens(firstMessage, adapter));
    const listeners = new Set<() => void>();
    let clashes: readonly Clash[] = [];
    let saving = false;
    let lastSave: KeyedValue<SaveStatus> | undefined;
    let state = buildState(session.tokens.getPermutation().input);

    function buildState(shownPermutation: Input): StudioState {
        const { tokens } = session;
        const output = adapter.write(tokens);
        return {
            tokens,
            shownPermutation:
                tokens.permutations.findByInput(shownPermutation) ?? tokens.getPermutation(),
            getValue: output.getValue,
            getForm: (node, at) => adapter.getForm?.(tokens, node, at),
            css: output.css,
            problems: [...message.adapter.problems, ...output.problems],
            changes: session.getChanges(),
            clashes,
            canUndo: session.canUndo,
            canRedo: session.canRedo,
            saving,
            saved: getValueForKey(lastSave, session.unsavedEdits),
        };
    }

    function publish(next: StudioState) {
        state = next;
        for (const listener of listeners) listener();
    }

    const stopSession = session.subscribe(() => publish(buildState(state.shownPermutation.input)));

    function setClashes(nextClashes: readonly Clash[]) {
        clashes = nextClashes;
        publish(buildState(state.shownPermutation.input));
    }

    function rereadFiles(files: StudioMessage["files"]): boolean {
        const rereadTokens = session.savedTokens.rereadAll(files);
        if (rereadTokens === session.savedTokens) return false;
        setClashes(session.rebase(rereadTokens));
        return true;
    }

    const save = saveEdits
        ? async () => {
              session.endStep();
              const sentEdits = session.unsavedEdits;
              saving = true;
              publish({ ...state, saving });
              let saved: SaveResult | undefined;
              let result: SaveStatus;
              try {
                  saved = await saveEdits(sentEdits, session.getChanges());
                  if (!saved.conflicts) session.markSaved(sentEdits);
                  if (saved.files) rereadFiles(saved.files);
                  result = saved;
              } catch (error) {
                  result = { failed: formatSaveError(error) };
              }
              saving = false;
              lastSave = { value: result, key: session.unsavedEdits };
              publish(buildState(state.shownPermutation.input));
              return saved;
          }
        : undefined;

    return {
        ...(save && { save }),
        get state() {
            return state;
        },
        get unsaved() {
            return session.unsavedEdits;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        destroy() {
            stopSession();
            listeners.clear();
        },
        show(input) {
            publish({ ...state, shownPermutation: state.tokens.getPermutation(input) });
        },
        do(result, options) {
            return session.do(result, options);
        },
        undo() {
            session.undo();
        },
        redo() {
            session.redo();
        },
        discard() {
            clashes = [];
            session.discard();
        },
        restore(edits) {
            setClashes(session.restore(edits));
        },
        resolveClash(clash, side) {
            const result =
                side === "yours" ? session.do(keepYours(session.tokens, clash)) : undefined;
            if (result && !result.tokens) return result;
            setClashes(clashes.filter((each) => each !== clash));
            return result;
        },
        getID(path) {
            return session.getID(path);
        },
        getPath(id) {
            return session.getPath(id);
        },
        receive(next) {
            const previous = message;
            message = next;
            if (
                next.entryFile !== previous.entryFile ||
                next.adapter.name !== previous.adapter.name ||
                !isEqualJson(next.adapter.settings, previous.adapter.settings)
            ) {
                adapter = createAdapter(next.adapter);
                setClashes(session.rebase(readTokens(next, adapter)));
                return;
            }
            if (
                !rereadFiles(next.files) &&
                !isEqualJson(next.adapter.problems, previous.adapter.problems)
            )
                publish(buildState(state.shownPermutation.input));
        },
    };
}

function readTokens({ files, entryFile }: StudioMessage, adapter: BuildAdapter): DesignTokens {
    return readFromMemory({ files, entryFile }, adapter.readOptions);
}
