import type { ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import type { PathIndex } from "./path-index";
import { unwrapRef } from "./paths";
import { nodesAt, sugarcubeExtensions } from "./tree-node";

export type Measure =
    | "font-size"
    | "letter-spacing"
    | "border-width"
    | "border-radius"
    | "gap"
    | (string & {});

/** Composite slots that say what a dimension they reference is measuring. */
const SLOTS: Record<string, Record<string, Measure>> = {
    typography: { fontSize: "font-size", letterSpacing: "letter-spacing" },
    border: { width: "border-width" },
};

export function declaredMeasure(trees: readonly TokenTree[], path: string): Measure | undefined {
    const segments = path.split(".");

    for (let depth = segments.length; depth > 0; depth--) {
        const at = segments.slice(0, depth).join(".");
        for (const node of nodesAt(trees, at)) {
            const measures = sugarcubeExtensions(node)?.measures;
            if (typeof measures === "string") return measures;
        }
    }

    return undefined;
}

/**
 * What a composite slot says about the token it references. Per §9.4 and §9.8
 * the slot types that token, so this is a declaration attached to it, not a
 * guess about usage. A token sitting in slots that disagree is left out.
 */
export function measuresBySlot(
    resolved: ResolvedTokens,
    pathIndex: PathIndex,
): Map<string, Measure> {
    const found = new Map<string, Set<Measure>>();

    for (const [handle] of pathIndex.entries()) {
        const token = pathIndex.readToken(resolved, handle);
        const slots = token?.$type ? SLOTS[token.$type] : undefined;
        const value = token?.$value;
        if (!slots || !value || typeof value !== "object" || Array.isArray(value)) continue;

        for (const [slot, measure] of Object.entries(slots)) {
            const target = unwrapRef((value as Record<string, unknown>)[slot]);
            if (!target) continue;
            const existing = found.get(target);
            if (existing) existing.add(measure);
            else found.set(target, new Set([measure]));
        }
    }

    const agreed = new Map<string, Measure>();
    for (const [path, measures] of found) {
        if (measures.size === 1) agreed.set(path, [...measures][0] as Measure);
    }
    return agreed;
}

export type MeasureLookup = (path: string) => Measure | undefined;

export function createMeasureLookup(
    trees: readonly TokenTree[],
    resolved: ResolvedTokens,
    pathIndex: PathIndex,
): MeasureLookup {
    const bySlot = measuresBySlot(resolved, pathIndex);

    return (path) => {
        const seen = new Set<string>();
        let current: string | undefined = path;

        while (current && !seen.has(current)) {
            seen.add(current);
            const found = declaredMeasure(trees, current) ?? bySlot.get(current);
            if (found) return found;
            current = unwrapRef(pathIndex.readValue(resolved, current));
        }

        return undefined;
    };
}
