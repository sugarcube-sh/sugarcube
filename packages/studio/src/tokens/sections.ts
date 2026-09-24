import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { stepLabel } from "./paths";

export type TokenRun = {
    name: string;
    tokens: ResolvedToken[];
};

export type GroupContent = {
    sets: TokenRun[];
    roles: TokenRun[];
};

export function isAlias(token: ResolvedToken): boolean {
    return typeof token.$value === "string" && token.$value.startsWith("{");
}

export function effectiveValue(token: ResolvedToken): unknown {
    return isAlias(token) ? (token.$resolvedValue ?? token.$value) : token.$value;
}

function push(runs: TokenRun[], name: string, token: ResolvedToken): void {
    const existing = runs.find((run) => run.name === name);
    if (existing) existing.tokens.push(token);
    else runs.push({ name, tokens: [token] });
}

export function groupContent(
    paths: readonly string[],
    read: (path: string) => ResolvedToken | undefined,
): GroupContent {
    const content: GroupContent = { sets: [], roles: [] };

    for (const path of paths) {
        const token = read(path);
        if (!token) continue;

        const name = path.split(".").slice(1, -1).join(".");
        push(isAlias(token) ? content.roles : content.sets, name, token);
    }

    return content;
}

export function asPaletteRamp(run: TokenRun, cssFor: (path: string) => string | undefined) {
    return {
        path: run.name,
        name: run.name,
        steps: run.tokens.map((token) => ({
            step: stepLabel(token.$path),
            value: token.$path,
            css: cssFor(token.$path),
        })),
    };
}
