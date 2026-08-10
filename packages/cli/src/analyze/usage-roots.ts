import { type TokenGraph, TYPOGRAPHY_CSS_PROPERTIES } from "@sugarcube-sh/core";
import type { VarRef } from "../lint/scan-css.js";

// Typography is the only token type that emits more than one CSS variable: the
// formatter writes `--<cssName>-<prop>` per sub-property (see core's
// `renderTypography` / `generateTypographyVariables`). So a used
// `var(--text-base-font-family)` must map back to the `text.base` node. The
// property list comes from core so we don't accidentally miss a property.

export function buildVarNameIndex(graph: TokenGraph): Map<string, string> {
    const index = new Map<string, string>();
    for (const node of graph.nodes.values()) {
        index.set(node.cssName, node.id);
        if (node.type === "typography") {
            for (const prop of TYPOGRAPHY_CSS_PROPERTIES) {
                index.set(`${node.cssName}-${prop}`, node.id);
            }
        }
    }
    return index;
}

export function lookupToken(index: Map<string, string>, varName: string): string | undefined {
    return index.get(varName.startsWith("--") ? varName.slice(2) : varName);
}

export function usageRoots(graph: TokenGraph, used: VarRef[]): Set<string> {
    const index = buildVarNameIndex(graph);
    const roots = new Set<string>();
    for (const ref of used) {
        const id = lookupToken(index, ref.name);
        if (id) roots.add(id);
    }
    return roots;
}
