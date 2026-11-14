import { useMemo, useState } from "react";
import { Icon } from "../components/ui/icon/Icons";
import { getBarMessages, startSave, getSaveOffer } from "../controllers/sign-in";
import type { SaveStatus } from "../controllers/studio";
import { getChangeBarActions } from "../controllers/undo";
import {
    type ChangeLine,
    toChangeLines,
    formatClashMessage,
    verbByChangeKind,
} from "../controllers/views";
import { Clashes } from "./Clashes";
import { useSignIn } from "../providers/sign-in-context";
import { useStudio, useStudioState } from "../providers/studio-context";

export function ChangeBar() {
    const studio = useStudio();
    const state = useStudioState((each) => each);
    const { changes, saving } = state;
    const lines = useMemo(() => toChangeLines(changes), [changes]);
    const [open, setOpen] = useState(false);
    const signIn = useSignIn();
    const count = lines.length;
    const saveOffer = getSaveOffer(signIn);
    const enabledActions = getChangeBarActions(studio, saveOffer);
    const messages = getBarMessages(state.saved, saveOffer);

    return (
        <div className="change-bar">
            <Clashes />
            {open && count > 0 && (
                <ul>
                    {lines.map((line) => (
                        <li key={`${line.kind} ${line.from} ${line.path} ${line.permutationLabel}`}>
                            <Line line={line} />
                        </li>
                    ))}
                </ul>
            )}
            {messages.outcome && <Outcome outcome={messages.outcome} />}
            {messages.reason && (
                <p>
                    {messages.reason}
                    {messages.installURL && (
                        <>
                            {" "}
                            <a href={messages.installURL}>Install on GitHub</a>
                        </>
                    )}
                </p>
            )}
            <div
                className="inspector-actions repel"
                role="toolbar"
                aria-label="Pending changes actions"
            >
                <div className="cluster" data-cluster-wrap="nowrap">
                    <button
                        type="button"
                        className="button"
                        data-role="tertiary"
                        disabled={!enabledActions.undo}
                        onClick={() => studio.undo()}
                    >
                        Undo
                    </button>
                    <button
                        type="button"
                        className="button"
                        data-role="tertiary"
                        disabled={!enabledActions.redo}
                        onClick={() => studio.redo()}
                    >
                        Redo
                    </button>
                </div>
                <button
                    type="button"
                    className="button inspector-actions-trigger"
                    disabled={count === 0}
                    aria-expanded={open && count > 0}
                    onClick={() => setOpen((was) => !was)}
                >
                    <span className="tabular-nums">{count}</span>
                    <span className="text-quiet">{count === 1 ? "change" : "changes"}</span>
                    <Icon name="caret-sort" className="inspector-actions-trigger-icon" />
                </button>
                <div className="cluster" data-cluster-wrap="nowrap">
                    <button
                        type="button"
                        className="button"
                        data-role="tertiary"
                        disabled={!enabledActions.discard}
                        onClick={() => studio.discard()}
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        className="button"
                        data-role="primary"
                        disabled={!enabledActions.save}
                        onClick={() => void startSave(studio, signIn)}
                    >
                        {saving ? "Saving" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Outcome({ outcome }: { outcome: SaveStatus }) {
    if ("failed" in outcome) return <p>{outcome.failed}</p>;
    if (outcome.pullRequest) {
        return (
            <p>
                Opened{" "}
                <a href={outcome.pullRequest.url} target="_blank" rel="noreferrer">
                    pull request #{outcome.pullRequest.number}
                </a>
            </p>
        );
    }
    if (outcome.conflicts) return <p>{formatClashMessage(outcome)}</p>;
    const files = [...outcome.savedFiles, ...outcome.deleted];
    return (
        <p>
            Saved:{" "}
            {files.map((file, index) => (
                <span key={file}>
                    {index > 0 && ", "}
                    <code>{file}</code>
                </span>
            ))}
        </p>
    );
}

function Line({ line }: { line: ChangeLine }) {
    const permutationSuffix = line.permutationLabel && ` (${line.permutationLabel})`;
    if (line.kind === "renamed" || line.kind === "group-renamed") {
        return (
            <>
                <code>{line.from}</code> renamed to <code>{line.path}</code>
                {permutationSuffix}
            </>
        );
    }
    return (
        <>
            {line.topLevel ? "Top level" : <code>{line.path}</code>} {verbByChangeKind[line.kind]}
            {permutationSuffix}
        </>
    );
}
