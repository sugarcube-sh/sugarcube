import { useCallback, useMemo, useRef, useState } from "react";
import { computeDiff } from "../../store/compute-diff";
import type { TokenDiffEntry } from "../../store/types";
import { usePathIndex, useTokenStore } from "../store/hooks";

type FileEdits = {
    path: string;
    edits: { jsonPath: string[]; value: unknown }[];
};

type SubmitState =
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "success"; prNumber: number; prURL: string }
    | { status: "error"; message: string };

const STUDIO_API =
    (import.meta as unknown as { env?: Record<string, string> }).env?.PUBLIC_STUDIO_API_URL ??
    "http://localhost:8787";

function diffToFileEdits(entries: TokenDiffEntry[]): FileEdits[] {
    const byFile = new Map<string, TokenDiffEntry[]>();
    for (const entry of entries) {
        const list = byFile.get(entry.sourcePath);
        if (list) {
            list.push(entry);
        } else {
            byFile.set(entry.sourcePath, [entry]);
        }
    }

    const result: FileEdits[] = [];
    for (const [path, fileEntries] of byFile) {
        result.push({
            path,
            edits: fileEntries.map((entry) => ({
                jsonPath: [...entry.path.split("."), "$value"],
                value: entry.to.$value,
            })),
        });
    }
    return result;
}

function fileSummary(files: FileEdits[]): { path: string; count: number }[] {
    return files.map((f) => ({ path: f.path, count: f.edits.length }));
}

export function SubmitPRDialog() {
    const resolved = useTokenStore((s) => s.resolved);
    const pathIndex = usePathIndex();
    const snapshotResolved = pathIndex.getSnapshot().resolved;

    const diff = useMemo(
        () => computeDiff(resolved, snapshotResolved, pathIndex),
        [resolved, snapshotResolved, pathIndex]
    );
    const files = useMemo(() => diffToFileEdits(diff), [diff]);
    const summary = useMemo(() => fileSummary(files), [files]);

    const dialogRef = useRef<HTMLDialogElement>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [state, setState] = useState<SubmitState>({ status: "idle" });

    const defaultTitle = useMemo(() => {
        const count = diff.length;
        if (count === 0) return "";
        if (count === 1 && diff[0]) return `Update ${diff[0].path}`;
        return `Update ${count} tokens`;
    }, [diff]);

    const handleOpen = useCallback(() => {
        setTitle(defaultTitle);
        setDescription("");
        setState({ status: "idle" });
        dialogRef.current?.showModal();
    }, [defaultTitle]);

    const handleClose = useCallback(() => {
        dialogRef.current?.close();
    }, []);

    const handleSubmit = useCallback(async () => {
        setState({ status: "submitting" });
        try {
            const res = await fetch(`${STUDIO_API}/submit-pr`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title || defaultTitle,
                    description,
                    files,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setState({ status: "error", message: data.error ?? "Submission failed" });
                return;
            }
            setState({ status: "success", prNumber: data.number, prURL: data.url });
        } catch {
            setState({ status: "error", message: "Could not reach the server. Please try again." });
        }
    }, [title, defaultTitle, description, files]);

    if (diff.length === 0) return null;

    return (
        <>
            <button type="button" onClick={handleOpen}>
                Submit as PR
            </button>
            <dialog ref={dialogRef}>
                {state.status === "success" ? (
                    <>
                        <h2>PR opened</h2>
                        <p>
                            <a href={state.prURL} target="_blank" rel="noopener noreferrer">
                                PR #{state.prNumber} — View on GitHub
                            </a>
                        </p>
                        <div>
                            <button type="button" onClick={handleClose}>
                                Close
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2>Submit as pull request</h2>
                        <p>Your edits will be submitted as a PR to the demo repo.</p>

                        <label>
                            Title
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={defaultTitle}
                            />
                        </label>

                        <label>
                            Description (optional)
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Describe your changes..."
                            />
                        </label>

                        <div>
                            <span>Files to change</span>
                            <ul>
                                {summary.map((f) => (
                                    <li key={f.path}>
                                        <code>{f.path}</code> — {f.count}{" "}
                                        {f.count === 1 ? "edit" : "edits"}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {state.status === "error" && <p>{state.message}</p>}

                        <div>
                            <button type="button" onClick={handleClose}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={state.status === "submitting"}
                                onClick={handleSubmit}
                            >
                                {state.status === "submitting" ? "Submitting..." : "Submit"}
                            </button>
                        </div>
                    </>
                )}
            </dialog>
        </>
    );
}
