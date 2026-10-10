/**
 * Looks for a resolver document (`*.resolver.json`) in a folder and below.
 *
 * @example
 * const found = await findResolver(process.cwd());
 * if (found.kind === "one") await read(found.path);
 */
export function findResolver(
    folder: string,
): Promise<{ kind: "one"; path: string } | { kind: "many"; paths: string[] } | { kind: "none" }> {
    throw new Error("not implemented yet");
}

export { read } from "./node/read.js";
export { type FileStats, onFileChanged } from "./node/file-changed.js";
export {
    type DocumentSource,
    type FileWatcher,
    type LiveDocument,
    type ReadEvent,
    liveDocument,
} from "./node/live-document.js";
