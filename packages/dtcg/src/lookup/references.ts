import type { Group, Permutation, Reference, Token } from "../model/index.js";

interface ReferenceIndex {
    position: Map<Reference, number>;
    byPath: Map<string, Reference[]>;
}

const indexCache = new WeakMap<Permutation, ReferenceIndex>();

export function referenceIndex(permutation: Permutation): ReferenceIndex {
    const cached = indexCache.get(permutation);
    if (cached) return cached;
    const position = new Map<Reference, number>();
    const byPath = new Map<string, Reference[]>();
    const visit = (items: readonly (Token | Group)[]) => {
        for (const each of items) {
            for (const reference of each.references) {
                position.set(reference, position.size);
                if (reference.pointsToPath === undefined) continue;
                const list = byPath.get(reference.pointsToPath);
                if (list) list.push(reference);
                else byPath.set(reference.pointsToPath, [reference]);
            }
            if (each.kind === "group") visit(each.children);
        }
    };
    visit([permutation.topLevel]);
    const built = { position, byPath };
    indexCache.set(permutation, built);
    return built;
}
