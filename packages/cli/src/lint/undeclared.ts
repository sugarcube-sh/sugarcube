import type { VarRef } from "../scan-css.js";

export interface UndeclaredReport {
    broken: VarRef[];
    fallback: VarRef[];
}

export function findUndeclared(
    used: VarRef[],
    declared: Set<string>,
    ignorePrefixes: string[],
): UndeclaredReport {
    const seen = new Set<string>();
    const broken: VarRef[] = [];
    const fallback: VarRef[] = [];

    for (const ref of used) {
        if (declared.has(ref.name)) continue;
        if (ignorePrefixes.some((prefix) => ref.name.startsWith(prefix))) continue;

        const key = `${ref.file}:${ref.line}:${ref.name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        (ref.hasFallback ? fallback : broken).push(ref);
    }

    return { broken, fallback };
}
