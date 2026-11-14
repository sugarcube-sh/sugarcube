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
import type { SaveOutcome, SentAdapter, StudioMessage, StudioSave } from "../protocol";
import type { BuildAdapter, BuildOutput, BuildProblem, ExtensionForm } from "./adapter";
import { type Held, heldFor } from "./held";
import { failedText } from "./views";

export type SaveShown = SaveOutcome | { readonly failed: string };

export interface StudioState {
    readonly tokens: DesignTokens;
    readonly showing: Permutation;
    readonly value: BuildOutput["value"];
    formFor(node: Token | Group, at?: DefinitionOptions["at"]): ExtensionForm | undefined;
    readonly css: string;
    readonly problems: readonly BuildProblem[];
    readonly changes: readonly Change[];
    readonly clashes: readonly Clash[];
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly saving: boolean;
    readonly saved: SaveShown | undefined;
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
    keep(clash: Clash, side: "yours" | "theirs"): CommitResult | undefined;
    getID(path: string): string | undefined;
    getPath(id: string): string | undefined;
    save?(): Promise<SaveOutcome | undefined>;
}

export function createStudio(
    first: StudioMessage,
    adapterFor: (sent: SentAdapter) => BuildAdapter,
    saveEdits?: StudioSave,
): Studio {
    let message = first;
    let adapter = adapterFor(first.adapter);
    const session = createSession(read(first, adapter));
    const listeners = new Set<() => void>();
    let clashes: readonly Clash[] = [];
    let saving = false;
    let lastSave: Held<SaveShown> | undefined;
    let state = built(session.tokens.getPermutation().input);

    function built(showing: Input): StudioState {
        const { tokens } = session;
        const written = adapter.write(tokens);
        return {
            tokens,
            showing: tokens.permutations.findByInput(showing) ?? tokens.getPermutation(),
            value: written.value,
            formFor: (node, at) => adapter.formFor?.(tokens, node, at),
            css: written.css,
            problems: [...message.adapter.problems, ...written.problems],
            changes: session.getChanges(),
            clashes,
            canUndo: session.canUndo,
            canRedo: session.canRedo,
            saving,
            saved: heldFor(lastSave, session.unsavedEdits),
        };
    }

    function publish(next: StudioState) {
        state = next;
        for (const listener of listeners) listener();
    }

    const stopSession = session.subscribe(() => publish(built(state.showing.input)));

    function settled(found: readonly Clash[]) {
        clashes = found;
        publish(built(state.showing.input));
    }

    function takeIn(files: StudioMessage["files"]): boolean {
        const fresh = session.savedTokens.rereadAll(files);
        if (fresh === session.savedTokens) return false;
        settled(session.rebase(fresh));
        return true;
    }

    const save = saveEdits
        ? async () => {
              session.endStep();
              const sent = session.unsavedEdits;
              saving = true;
              publish({ ...state, saving });
              let saved: SaveOutcome | undefined;
              let shown: SaveShown;
              try {
                  saved = await saveEdits(sent, session.getChanges());
                  if (!saved.conflicts) session.markSaved(sent);
                  if (saved.files) takeIn(saved.files);
                  shown = saved;
              } catch (error) {
                  shown = { failed: failedText(error) };
              }
              saving = false;
              lastSave = { value: shown, about: session.unsavedEdits };
              publish(built(state.showing.input));
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
            publish({ ...state, showing: state.tokens.getPermutation(input) });
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
            settled(session.restore(edits));
        },
        keep(clash, side) {
            const done =
                side === "yours" ? session.do(keepYours(session.tokens, clash)) : undefined;
            if (done && !done.tokens) return done;
            settled(clashes.filter((each) => each !== clash));
            return done;
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
                adapter = adapterFor(next.adapter);
                settled(session.rebase(read(next, adapter)));
                return;
            }
            if (
                !takeIn(next.files) &&
                !isEqualJson(next.adapter.problems, previous.adapter.problems)
            )
                publish(built(state.showing.input));
        },
    };
}

function read({ files, entryFile }: StudioMessage, adapter: BuildAdapter): DesignTokens {
    return readFromMemory({ files, entryFile }, adapter.read);
}
