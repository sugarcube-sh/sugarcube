import type { TokenEdge, TokenGraph } from "../../types/graph.js";

function buildAdjacency(edges: TokenEdge[]): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
        const targets = adjacency.get(edge.from);
        if (targets) targets.push(edge.to);
        else adjacency.set(edge.from, [edge.to]);
    }
    return adjacency;
}

/**
 * Collect every token that your used tokens depend on, following alias chains.
 *
 * `roots` are the tokens your CSS or markup references directly. From each one,
 * we walk "this token points at that token" links until nothing new turns up —
 * so a primitive like `color.pink.600` counts as reached even when your CSS
 * only ever references a semantic alias above it.
 *
 * If a token is reachable in any context (light, dark, a brand variant, etc.),
 * it counts — the generated output includes all of them. Vars that aren't
 * sugarcube tokens are ignored.
 */
export function reachableFrom(graph: TokenGraph, roots: Iterable<string>): Set<string> {
    const adjacency = buildAdjacency(graph.edges);
    const reached = new Set<string>();
    const stack: string[] = [];
    for (const root of roots) {
        if (graph.nodes.has(root)) stack.push(root);
    }

    while (stack.length > 0) {
        const id = stack.pop() as string;
        if (reached.has(id)) continue;
        reached.add(id);
        for (const target of adjacency.get(id) ?? []) {
            if (!reached.has(target)) stack.push(target);
        }
    }

    return reached;
}

/**
 * This is the graph-aware inverse of the lint's dangling check: dangling finds *used but
 * undeclared*; this finds *declared but never (transitively) used*.
 */
export function findUnusedTokens(graph: TokenGraph, roots: Iterable<string>): string[] {
    const reachable = reachableFrom(graph, roots);
    return [...graph.nodes.keys()].filter((id) => !reachable.has(id)).sort();
}

function buildReverseAdjacency(edges: TokenEdge[]): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
        const sources = adjacency.get(edge.to);
        if (sources) sources.push(edge.from);
        else adjacency.set(edge.to, [edge.from]);
    }
    return adjacency;
}

export function directDependents(graph: TokenGraph, target: string): string[] {
    const dependents = new Set<string>();
    for (const edge of graph.edges) {
        if (edge.to === target) dependents.add(edge.from);
    }
    return [...dependents].sort();
}

export function dependentsOf(graph: TokenGraph, targets: Iterable<string>): Set<string> {
    const reverse = buildReverseAdjacency(graph.edges);
    const dependents = new Set<string>();
    const stack = [...targets];

    while (stack.length > 0) {
        const id = stack.pop() as string;
        for (const dependent of reverse.get(id) ?? []) {
            if (!dependents.has(dependent)) {
                dependents.add(dependent);
                stack.push(dependent);
            }
        }
    }

    return dependents;
}

export function dependentsVia(graph: TokenGraph, target: string): Map<string, string> {
    const reverse = buildReverseAdjacency(graph.edges);
    const via = new Map<string, string>();
    const stack: string[] = [target];

    while (stack.length > 0) {
        const id = stack.pop() as string;
        for (const dependent of reverse.get(id) ?? []) {
            if (!via.has(dependent)) {
                via.set(dependent, id);
                stack.push(dependent);
            }
        }
    }

    return via;
}
