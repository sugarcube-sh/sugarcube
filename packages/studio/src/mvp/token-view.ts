import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import type { Handle, PathIndex } from "../tokens/path-index";
import { lastSegment } from "../tokens/paths";

export type TokenOverride = {
    context: string;
    sourcePath: string;
    value: unknown;
};

export type TokenRow = {
    handle: Handle;
    path: string;
    name: string;
    type?: string;
    description?: string;
    value: unknown;
    sourcePath?: string;
    overrides: TokenOverride[];
};

type Node = {
    $value?: unknown;
    $type?: string;
    $description?: string;
    $source?: { context?: string; sourcePath?: string };
};

export function baseContext(index: PathIndex, defaultContext?: string | null): string {
    if (defaultContext && index.contexts.includes(defaultContext)) return defaultContext;
    return index.contexts[0] ?? "default";
}

export function buildTokenRow(
    index: PathIndex,
    resolved: ResolvedTokens,
    handle: Handle,
    base: string,
    name?: string,
): TokenRow | undefined {
    const path = index.pathOf(handle);
    const entries = index.entriesFor(handle);
    if (path === undefined || entries.length === 0) return undefined;

    const baseEntry = entries.find((entry) => entry.context === base);
    const baseNode = baseEntry ? (resolved[baseEntry.key] as Node | undefined) : undefined;
    const baseSource = baseNode?.$source?.sourcePath;

    const overrides: TokenOverride[] = [];
    let type = baseNode?.$type;

    for (const entry of entries) {
        if (entry === baseEntry) continue;
        const node = resolved[entry.key] as Node | undefined;
        if (!node) continue;
        type ??= node.$type;

        const sourcePath = node.$source?.sourcePath;
        if (sourcePath === undefined || sourcePath === baseSource) continue;
        overrides.push({ context: entry.context, sourcePath, value: node.$value });
    }

    return {
        handle,
        path,
        name: name ?? lastSegment(path),
        type,
        description: baseNode?.$description,
        value: baseNode?.$value,
        sourcePath: baseSource,
        overrides,
    };
}

export function overrideFiles(row: TokenRow): string[] {
    const seen: string[] = [];
    for (const override of row.overrides) {
        const file = fileName(override.sourcePath);
        if (!seen.includes(file)) seen.push(file);
    }
    return seen;
}

export function fileName(sourcePath: string): string {
    const slash = sourcePath.lastIndexOf("/");
    return slash === -1 ? sourcePath : sourcePath.slice(slash + 1);
}
