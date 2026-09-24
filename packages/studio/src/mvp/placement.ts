import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import type { Handle, PathIndex } from "../tokens/path-index";

export type Placement =
    | { kind: "settled"; sourcePath: string }
    | { kind: "ask"; candidates: string[] }
    | { kind: "none" };

type Sourced = { $source?: { sourcePath?: string } };

/**
 * `writable` is the set of files the working copy holds. A file only qualifies
 * if it is in there — which is a fact rather than a guess about its name.
 *
 * The resolver document is a token file whenever tokens are declared inline in
 * it (spec 4.1.4, 4.1.5.1), so it cannot be excluded by name. It earns its
 * place in `writable` exactly when it holds tokens. A generated scale step
 * reports the resolver because it was never authored in a file, and is excluded
 * for the same reason: the resolver is not among the files held.
 */
function sourcePathsOf(
    resolved: ResolvedTokens,
    keys: Iterable<string>,
    into: string[] = [],
    writable?: ReadonlySet<string>,
): string[] {
    for (const key of keys) {
        const node = resolved[key] as Sourced | undefined;
        const sourcePath = node?.$source?.sourcePath;
        if (!sourcePath || (writable && !writable.has(sourcePath))) continue;
        if (!into.includes(sourcePath)) into.push(sourcePath);
    }
    return into;
}

function keysIn(index: PathIndex, handle: Handle, context: string): string[] {
    const entries = index.entriesFor(handle);
    const matching = entries.filter((entry) => entry.context === context);
    return (matching.length > 0 ? matching : entries).map((entry) => entry.key);
}

export function tokenFiles(
    index: PathIndex,
    resolved: ResolvedTokens,
    writable?: ReadonlySet<string>,
): string[] {
    const files: string[] = [];
    for (const [, entries] of index.entries()) {
        sourcePathsOf(
            resolved,
            entries.map((entry) => entry.key),
            files,
            writable,
        );
    }
    return files.sort();
}

function ancestorGroups(path: string): string[] {
    const segments = path.split(".");
    const out: string[] = [];
    for (let i = segments.length - 1; i > 0; i--) out.push(segments.slice(0, i).join("."));
    return out;
}

export function placementFor(
    index: PathIndex,
    resolved: ResolvedTokens,
    context: string,
    parent?: Handle,
    writable?: ReadonlySet<string>,
): Placement {
    const files = tokenFiles(index, resolved, writable);
    if (files.length === 0) return { kind: "none" };
    if (files.length === 1) return { kind: "settled", sourcePath: files[0] as string };

    if (parent === undefined) return { kind: "ask", candidates: files };

    const parentPath = index.pathOf(parent);
    if (parentPath === undefined) return { kind: "ask", candidates: files };

    const scopes: ReadonlyArray<readonly Handle[]> = [
        index.childTokens(parentPath),
        index.under(parentPath),
        ...ancestorGroups(parentPath).map((ancestor) => index.under(ancestor)),
    ];

    for (const scope of scopes) {
        const found: string[] = [];
        for (const child of scope) {
            sourcePathsOf(resolved, keysIn(index, child, context), found, writable);
        }
        if (found.length === 1) return { kind: "settled", sourcePath: found[0] as string };
        if (found.length > 1) return { kind: "ask", candidates: found.sort() };
    }

    return { kind: "ask", candidates: files };
}

export function siblingType(
    index: PathIndex,
    resolved: ResolvedTokens,
    context: string,
    parent?: Handle,
): string | undefined {
    if (parent === undefined) return undefined;
    const parentPath = index.pathOf(parent);
    if (parentPath === undefined) return undefined;

    const seen: string[] = [];
    for (const child of index.childTokens(parentPath)) {
        for (const key of keysIn(index, child, context)) {
            const type = (resolved[key] as { $type?: string } | undefined)?.$type;
            if (type && !seen.includes(type)) seen.push(type);
        }
    }

    return seen.length === 1 ? seen[0] : undefined;
}
