// A token editor in the browser, with a server that owns the files. The server reads the files and
// sends their text. The browser opens the same design system from that text and edits it. A save
// sends back only the edits, and the server writes them, refusing any file that isn't one of the
// token files. If a file breaks mid-edit, the browser keeps the last version that read cleanly.
import { errors } from "@sugarcube-sh/dtcg";
import { openFromMemory, type FileOp, type Project } from "@sugarcube-sh/dtcg-edit";
import { applyToDisk, open } from "@sugarcube-sh/dtcg-edit/node";

declare function sendToBrowser(entry: string, files: Readonly<Record<string, string>>): void;

const entry = "tokens/tokens.resolver.json";
let serving: Project | undefined;

export async function serve(): Promise<void> {
    const next = await open(entry);
    const unreadable = errors(next.doc).some(
        (d) => d.kind === "invalid-json" || d.kind === "file-not-found",
    );
    if (unreadable && serving) return;
    serving = next;
    sendToBrowser(entry, next.files);
}

export function openInBrowser(files: Readonly<Record<string, string>>): Project {
    return openFromMemory({ files: { ...files }, entry: "tokens.resolver.json" });
}

export async function save(ops: FileOp[]): Promise<string> {
    if (!serving) return "Nothing to save to yet";
    const result = await applyToDisk(serving, ops);
    if ("refused" in result) return result.refused.reason;
    if ("conflicts" in result) return result.conflicts.map((c) => c.reason).join("\n");
    await serve();
    return `Saved ${result.written.length} files`;
}
