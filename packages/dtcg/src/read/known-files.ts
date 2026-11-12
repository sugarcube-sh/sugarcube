import { exceptionMessages } from "../error-messages.js";
import type { FileResponse, FileText, FileRequest } from "./files.js";
import { getFolder, join, normalise } from "./paths.js";

export interface KnownFiles {
    entryFile: string;
    texts: ReadonlyMap<string, FileText>;
    hasEveryFile: boolean;
}

export function createKnownFiles(entryFile: string, files: Iterable<[string, string]>): KnownFiles {
    return {
        entryFile: normalise(entryFile),
        texts: new Map([...files].map(([path, text]) => [normalise(path), { text }])),
        hasEveryFile: true,
    };
}

export function respondFromKnownFiles(known: KnownFiles, request: FileRequest): FileResponse {
    const folder = getFolder(known.entryFile);
    const answer: FileResponse = {};
    for (const path of request) {
        const text = known.texts.get(join(folder, path));
        if (text) answer[path] = text;
        else if (known.hasEveryFile) answer[path] = { missing: true };
        else throw new TypeError(exceptionMessages.notInLastRead(path));
    }
    return answer;
}

export function withChanges(
    known: KnownFiles,
    changed: Readonly<Record<string, string | null>>,
): KnownFiles {
    const folder = getFolder(known.entryFile);
    const texts = new Map(known.texts);
    for (const [file, text] of Object.entries(changed)) {
        texts.set(join(folder, file), text === null ? { missing: true } : { text });
    }
    return { ...known, texts };
}
