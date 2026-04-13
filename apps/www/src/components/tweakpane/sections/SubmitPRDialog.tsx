import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/registry/components/dialog/react/dialog";
import { useCallback, useMemo, useState } from "react";
import { type TokenDiffEntry, computeDiff, useTokenStore } from "../store/TokenStore";

type FileEdits = {
    path: string;
    edits: { jsonPath: string[]; value: unknown }[];
};

type SubmitState =
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "success"; prNumber: number; prURL: string }
    | { status: "error"; message: string };

const STUDIO_API = import.meta.env.PUBLIC_STUDIO_API_URL ?? "http://localhost:8787";

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
    const diff = useMemo(() => computeDiff(resolved), [resolved]);
    const files = useMemo(() => diffToFileEdits(diff), [diff]);
    const summary = useMemo(() => fileSummary(files), [files]);

    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [state, setState] = useState<SubmitState>({ status: "idle" });

    const defaultTitle = useMemo(() => {
        const count = diff.length;
        if (count === 0) return "";
        if (count === 1 && diff[0]) return `Update ${diff[0].path}`;
        return `Update ${count} tokens`;
    }, [diff]);

    const handleOpen = useCallback(
        (isOpen: boolean) => {
            setOpen(isOpen);
            if (isOpen) {
                setTitle(defaultTitle);
                setDescription("");
                setState({ status: "idle" });
            }
        },
        [defaultTitle]
    );

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
                setState({
                    status: "error",
                    message: data.error ?? "Submission failed",
                });
                return;
            }
            setState({
                status: "success",
                prNumber: data.number,
                prURL: data.url,
            });
        } catch {
            setState({
                status: "error",
                message: "Could not reach the server. Please try again.",
            });
        }
    }, [title, defaultTitle, description, files]);

    if (diff.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                <button type="button" className="tweakpane-submit-pr-button">
                    Submit as PR
                </button>
            </DialogTrigger>
            <DialogContent className="tweakpane-submit-dialog">
                {state.status === "success" ? (
                    <>
                        <DialogTitle>PR opened</DialogTitle>
                        <p className="tweakpane-submit-success">
                            <a href={state.prURL} target="_blank" rel="noopener noreferrer">
                                PR #{state.prNumber} — View on GitHub
                            </a>
                        </p>
                        <div className="tweakpane-submit-actions">
                            <DialogClose>Close</DialogClose>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogTitle>Submit as pull request</DialogTitle>
                        <DialogDescription>
                            Your edits will be submitted as a PR to the demo repo.
                        </DialogDescription>

                        <label className="tweakpane-submit-label">
                            Title
                            <input
                                type="text"
                                className="tweakpane-submit-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={defaultTitle}
                            />
                        </label>

                        <label className="tweakpane-submit-label">
                            Description (optional)
                            <textarea
                                className="tweakpane-submit-textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Describe your changes..."
                            />
                        </label>

                        <div className="tweakpane-submit-files">
                            <span className="tweakpane-submit-files-heading">Files to change</span>
                            <ul>
                                {summary.map((f) => (
                                    <li key={f.path}>
                                        <code>{f.path}</code> — {f.count}{" "}
                                        {f.count === 1 ? "edit" : "edits"}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {state.status === "error" && (
                            <p className="tweakpane-submit-error">{state.message}</p>
                        )}

                        <div className="tweakpane-submit-actions">
                            <DialogClose>Cancel</DialogClose>
                            <button
                                type="button"
                                className="tweakpane-submit-confirm"
                                disabled={state.status === "submitting"}
                                onClick={handleSubmit}
                            >
                                {state.status === "submitting" ? "Submitting..." : "Submit"}
                            </button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
