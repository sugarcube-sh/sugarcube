import type { Diagnostic, Input, SetRef, Span } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { type JsonFile, type JsonProblem, type ParsedJson, parseJson, spanOf } from "./json.js";
import { isResolver, readResolver } from "./resolver.js";

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

type FileKind = "tokens" | "resolver";

interface State {
    texts: Map<string, FileText>;
    parsed: Map<string, ParsedJson>;
    outcomes: Map<string, JsonFile | undefined>;
    loaded: Loaded;
}

export function* load(
    start: { entry: string } | { files: string[] },
): Generator<Request, Loaded, Answer> {
    const state: State = {
        texts: new Map(),
        parsed: new Map(),
        outcomes: new Map(),
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
    yield* ask(state, files);

    const resolver = files.find((file) => {
        const root = parse(state, file)?.root;
        return root !== undefined && isResolver(root);
    });
    if (resolver !== undefined) {
        loadResolver(state, resolver);
        return state.loaded;
    }

    const sets: SetRef[] = [];
    for (const file of files) {
        use(state, file, "tokens");
        sets.push({ file, from: { set: "default" } });
        state.loaded.readers[file] = "everyone";
    }
    state.loaded.permutations.push({ input: {}, label: "default", sets });
    return state.loaded;
}

function* ask(state: State, paths: string[]): Generator<Request, void, Answer> {
    const wanted = [...new Set(paths)].filter((path) => !state.texts.has(path));
    if (wanted.length === 0) return;
    const answer = yield wanted;
    for (const path of wanted) state.texts.set(path, answer[path] ?? { missing: true });
}

function parse(state: State, path: string): ParsedJson | undefined {
    const cached = state.parsed.get(path);
    if (cached) return cached;
    const text = state.texts.get(path);
    if (!text || "missing" in text) return undefined;
    const parsed = parseJson(text.text);
    state.parsed.set(path, parsed);
    return parsed;
}

function use(
    state: State,
    path: string,
    kind: FileKind,
    referencedFrom?: { file: string; at: Span },
): JsonFile | undefined {
    if (state.outcomes.has(path)) return state.outcomes.get(path);
    state.loaded.files.push(path);
    const file = open(state, path, kind, referencedFrom);
    state.outcomes.set(path, file);
    if (file) state.loaded.trees[path] = file;
    return file;
}

function open(
    state: State,
    path: string,
    kind: FileKind,
    referencedFrom?: { file: string; at: Span },
): JsonFile | undefined {
    const { diagnostics } = state.loaded;
    const parsed = parse(state, path);
    if (!parsed) {
        diagnostics.push(
            diagnostic(
                "file-not-found",
                { file: path, ...(referencedFrom && { referencedFrom: referencedFrom.file }) },
                { ...(referencedFrom && { at: referencedFrom.at }) },
            ),
        );
        return undefined;
    }

    const at = (node: { offset: number; length: number }) =>
        spanOf(path, parsed.lineStarts, node.offset, node.length);
    const { root, syntax } = parsed;
    const problems: JsonProblem[] = [
        ...(kind === "tokens" ? parsed.comments : []),
        ...(syntax ? [syntax] : []),
        ...(root && !syntax && root.type !== "object"
            ? [{ reason: "not-an-object" as const, offset: root.offset, length: root.length }]
            : []),
    ];
    for (const problem of problems.sort((a, b) => a.offset - b.offset)) {
        diagnostics.push(
            diagnostic("invalid-json", { reason: problem.reason }, { at: at(problem) }),
        );
    }
    if (problems.length > 0 || !root) return undefined;

    for (const { key, first, last } of parsed.duplicates) {
        diagnostics.push(
            diagnostic(
                "duplicate-key",
                { key },
                { at: at(last), related: [{ message: "also written here", at: at(first) }] },
            ),
        );
    }
    return { path, root, lineStarts: parsed.lineStarts, hidden: parsed.hidden };
}

function loadResolver(state: State, path: string): void {
    const file = use(state, path, "resolver");
    if (!file) return;
    const resolver = readResolver(file, state.loaded.diagnostics);
    for (const item of resolver.order) {
        if (item.kind !== "modifier") continue;
        const { name, contexts, default: fallback } = item.modifier;
        state.loaded.modifiers[name] = {
            contexts: [...contexts.keys()],
            ...(fallback !== undefined && { default: fallback }),
        };
    }
}
