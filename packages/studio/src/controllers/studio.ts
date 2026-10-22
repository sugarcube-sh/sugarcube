import {
    type Change,
    type DesignTokens,
    type Group,
    type Input,
    type Permutation,
    type Token,
    readFromMemory,
    sameJson,
} from "@sugarcube-sh/dtcg";
import {
    type Clash,
    type Committed,
    type Edits,
    type OpResult,
    type PlaceAt,
    type StepOptions,
    createSession,
    keepYours,
} from "@sugarcube-sh/dtcg-edit";
import type { SaveOutcome, SentAdapter, StudioMessage, StudioSave } from "../protocol";
import type { BuildAdapter, BuildOutput, BuildProblem, ExtensionForm } from "./adapter";

export interface StudioState {
    readonly tokens: DesignTokens;
    readonly showing: Permutation;
    readonly value: BuildOutput["value"];
    formFor(node: Token | Group, at?: PlaceAt["at"]): ExtensionForm | undefined;
    readonly css: string;
    readonly problems: readonly BuildProblem[];
    readonly changes: readonly Change[];
    readonly clashes: readonly Clash[];
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly saving: boolean;
}

export interface Studio {
    readonly state: StudioState;
    readonly unsaved: Edits;
    subscribe(listener: () => void): () => void;
    destroy(): void;
    show(input: Input): void;
    receive(message: StudioMessage): void;
    do(result: OpResult, options?: StepOptions): Committed;
    undo(): void;
    redo(): void;
    discard(): void;
    restore(edits: Edits): void;
    keep(clash: Clash, side: "yours" | "theirs"): Committed | undefined;
    idOf(path: string): string | undefined;
    pathOf(id: string): string | undefined;
    save?(): Promise<SaveOutcome>;
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
    let state = built(session.tokens.permutation().input);

    function built(showing: Input): StudioState {
        const { tokens } = session;
        const written = adapter.write(tokens);
        return {
            tokens,
            showing: tokens.permutations.matching(showing) ?? tokens.permutation(),
            value: written.value,
            formFor: (node, at) => adapter.formFor?.(tokens, node, at),
            css: written.css,
            problems: [...message.adapter.problems, ...written.problems],
            changes: session.changes(),
            clashes,
            canUndo: session.canUndo,
            canRedo: session.canRedo,
            saving,
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
        const fresh = session.opened.rereadAll(files);
        if (fresh === session.opened) return false;
        settled(session.rebase(fresh));
        return true;
    }

    const save = saveEdits
        ? async () => {
              session.endStep();
              const sent = session.unsaved;
              saving = true;
              publish({ ...state, saving });
              try {
                  const saved = await saveEdits(sent, session.changes());
                  if (!saved.conflicts) session.markSaved(sent);
                  if (saved.files) takeIn(saved.files);
                  return saved;
              } finally {
                  saving = false;
                  publish({ ...state, saving });
              }
          }
        : undefined;

    return {
        ...(save && { save }),
        get state() {
            return state;
        },
        get unsaved() {
            return session.unsaved;
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
            publish({ ...state, showing: state.tokens.permutation(input) });
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
        idOf(path) {
            return session.idOf(path);
        },
        pathOf(id) {
            return session.pathOf(id);
        },
        receive(next) {
            const previous = message;
            message = next;
            if (
                next.entry !== previous.entry ||
                next.adapter.name !== previous.adapter.name ||
                !sameJson(next.adapter.settings, previous.adapter.settings)
            ) {
                adapter = adapterFor(next.adapter);
                settled(session.rebase(read(next, adapter)));
                return;
            }
            if (!takeIn(next.files) && !sameJson(next.adapter.problems, previous.adapter.problems))
                publish(built(state.showing.input));
        },
    };
}

function read({ files, entry }: StudioMessage, adapter: BuildAdapter): DesignTokens {
    return readFromMemory({ files, entry }, adapter.read);
}
