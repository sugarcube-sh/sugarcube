import type { Diagnostic, Input, SetRef, Span } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { type JsonFile, parseJson, spanOf } from "./json.js";

export type FileText = { text: string } | { missing: true };
export type Request = string[];
export type Answer = Record<string, FileText>;

export interface LoadedPermutation {
    input: Input;
    label: string;
    sets: SetRef[];
}

export interface Loaded {
    files: string[];
    trees: Record<string, JsonFile>;
    modifiers: Record<string, { contexts: string[]; default?: string }>;
    readers: Record<string, "everyone" | Input[]>;
    permutations: LoadedPermutation[];
    diagnostics: Diagnostic[];
}

interface State {
    texts: Map<string, FileText>;
    loaded: Loaded;
}

export function* load(
    start: { entry: string } | { files: string[] },
): Generator<Request, Loaded, Answer> {
    const state: State = {
        texts: new Map(),
        loaded: {
            files: [],
            trees: {},
            modifiers: {},
            readers: {},
            permutations: [],
            diagnostics: [],
        },
    };
    const files = "entry" in start ? [start.entry] : start.files;
    yield* fetch(state, files);

    const sets: SetRef[] = [];
    for (const file of files) {
        readTokenFile(state, file);
        sets.push({ file, from: { set: "default" } });
        state.loaded.readers[file] = "everyone";
    }
    state.loaded.permutations.push({ input: {}, label: "default", sets });
    return state.loaded;
}

function* fetch(state: State, paths: string[]): Generator<Request, void, Answer> {
    const wanted = [...new Set(paths)].filter((path) => !state.texts.has(path));
    if (wanted.length === 0) return;
    const answer = yield wanted;
    for (const path of wanted) {
        state.texts.set(path, answer[path] ?? { missing: true });
        state.loaded.files.push(path);
    }
}

function readTokenFile(
    state: State,
    path: string,
    referencedFrom?: { file: string; at: Span },
): void {
    const { loaded } = state;
    if (path in loaded.trees) return;

    const text = state.texts.get(path);
    if (!text || "missing" in text) {
        loaded.diagnostics.push(
            diagnostic(
                "file-not-found",
                referencedFrom
                    ? { file: path, referencedFrom: referencedFrom.file }
                    : { file: path },
                referencedFrom ? { at: referencedFrom.at } : {},
            ),
        );
        return;
    }

    const parsed = parseJson(path, text.text);
    if (!parsed.ok) {
        for (const { reason, offset, length } of parsed.problems) {
            loaded.diagnostics.push(
                diagnostic(
                    "invalid-json",
                    { reason },
                    { at: spanOf(path, parsed.lineStarts, offset, length) },
                ),
            );
        }
        return;
    }

    for (const { reason, offset, length } of parsed.comments) {
        loaded.diagnostics.push(
            diagnostic(
                "invalid-json",
                { reason },
                { at: spanOf(path, parsed.file.lineStarts, offset, length) },
            ),
        );
    }
    if (parsed.comments.length > 0) return;

    const { lineStarts } = parsed.file;
    for (const { key, first, last } of parsed.duplicates) {
        const keyOf = (property: typeof first) => property.children?.[0] ?? property;
        loaded.diagnostics.push(
            diagnostic(
                "duplicate-key",
                { key },
                {
                    at: spanOf(path, lineStarts, keyOf(last).offset, keyOf(last).length),
                    related: [
                        {
                            message: "also written here",
                            at: spanOf(path, lineStarts, keyOf(first).offset, keyOf(first).length),
                        },
                    ],
                },
            ),
        );
    }
    loaded.trees[path] = parsed.file;
}
