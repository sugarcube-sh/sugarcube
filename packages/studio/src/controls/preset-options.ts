import type { PresetBinding, ResolvedTokens } from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";
import { lastSegment, resolveTerminalPath } from "../tokens/paths";

export type ResolvedOption = {
    key: string;
    label: string;
    reference: string;
};

export function resolveOptions(
    options: PresetBinding["options"],
    pathIndex: PathIndex,
    baseline: ResolvedTokens,
): ResolvedOption[] {
    if (typeof options === "string") {
        return resolveGlobOptions(options, pathIndex, baseline);
    }
    return Object.entries(options).map(([key, reference]) => ({
        key,
        label: key,
        reference,
    }));
}

function resolveGlobOptions(
    pattern: string,
    pathIndex: PathIndex,
    baseline: ResolvedTokens,
): ResolvedOption[] {
    const getToken = (path: string) => pathIndex.readValue(baseline, path);
    const matches = pathIndex.matching(pattern);
    const matchSet = new Set(matches);
    return matches
        .filter((path) => {
            const terminal = resolveTerminalPath(path, getToken);
            return terminal === path || !matchSet.has(terminal);
        })
        .map((path) => ({
            key: path,
            label: lastSegment(path),
            reference: `{${path}}`,
        }));
}
