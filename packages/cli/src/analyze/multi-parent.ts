import type { TokenGraph } from "@sugarcube-sh/core";

export function defaultContextParents(
    graph: TokenGraph,
    parents: Map<string, string[]>,
): Map<string, string> {
    const defaultContext = graph.defaultContext;
    if (!defaultContext) return new Map();

    const preferred = new Map<string, string>();
    for (const edge of graph.edges) {
        const hops = parents.get(edge.from);
        if (!hops?.includes(edge.to)) continue;
        if (edge.contexts.includes(defaultContext)) preferred.set(edge.from, edge.to);
    }

    return preferred;
}

export function chooseParents(
    parents: Map<string, string[]>,
    weight: (id: string) => number,
    preferred: Map<string, string> = new Map(),
): Map<string, string> {
    const chosen = new Map<string, string>();

    for (const [dependent, hops] of parents) {
        const fromDefault = preferred.get(dependent);
        if (fromDefault && hops.includes(fromDefault)) {
            chosen.set(dependent, fromDefault);
            continue;
        }

        const best = [...hops].sort(
            (a, b) => weight(b) - weight(a) || a.localeCompare(b),
        )[0] as string;
        chosen.set(dependent, best);
    }

    return chosen;
}

function contextInput(graph: TokenGraph, id: string): Record<string, string> {
    const info = graph.contexts.find((context) => context.id === id);
    return (info?.input ?? {}) as Record<string, string>;
}

export function describeElidedParents(
    graph: TokenGraph,
    parents: Map<string, string[]>,
): Map<string, string> {
    const described = new Map<string, string>();

    for (const [dependent, hops] of parents) {
        if (hops.length < 2) continue;

        const deciding = partitioningModifiers(graph, dependent, hops);

        if (deciding.length === 1) {
            described.set(dependent, `per ${deciding[0]}`);
        } else if (deciding.length > 1) {
            described.set(dependent, "per context");
        } else if (contextsDiffer(graph, dependent, hops)) {
            // Contexts vary but carry no modifier input to name — a light/dark system built
            // without permutations, say.
            described.set(dependent, "per context");
        } else {
            described.set(dependent, `${hops.length} references`);
        }
    }

    return described;
}

function partitioningModifiers(graph: TokenGraph, dependent: string, hops: string[]): string[] {
    const parentsByValue = new Map<string, Map<string, Set<string>>>();

    for (const edge of graph.edges) {
        if (edge.from !== dependent || !hops.includes(edge.to)) continue;

        for (const context of edge.contexts) {
            for (const [modifier, value] of Object.entries(contextInput(graph, context))) {
                const values = parentsByValue.get(modifier) ?? new Map<string, Set<string>>();
                const reached = values.get(value) ?? new Set<string>();
                reached.add(edge.to);
                values.set(value, reached);
                parentsByValue.set(modifier, values);
            }
        }
    }

    return [...parentsByValue]
        .filter(
            ([, values]) =>
                values.size > 1 && [...values.values()].every((parents) => parents.size === 1),
        )
        .map(([modifier]) => modifier);
}

/** Whether a dependent reaches its parents through different contexts at all. */
function contextsDiffer(graph: TokenGraph, dependent: string, hops: string[]): boolean {
    const perParent = new Map<string, string>();
    for (const edge of graph.edges) {
        if (edge.from !== dependent || !hops.includes(edge.to)) continue;
        perParent.set(edge.to, [...edge.contexts].sort().join(","));
    }

    return new Set(perParent.values()).size > 1;
}
