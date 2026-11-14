import type { VarReference } from "../scan-css.js";

export interface UndeclaredReport {
    withoutFallback: VarReference[];
    withFallback: VarReference[];
}

export function findUndeclared(
    used: VarReference[],
    declared: Set<string>,
    ignorePrefixes: string[],
): UndeclaredReport {
    const seen = new Set<string>();
    const withoutFallback: VarReference[] = [];
    const withFallback: VarReference[] = [];

    for (const ref of used) {
        if (declared.has(ref.name)) continue;
        if (ignorePrefixes.some((prefix) => ref.name.startsWith(prefix))) continue;

        const key = `${ref.file}:${ref.line}:${ref.name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        (ref.hasFallback ? withFallback : withoutFallback).push(ref);
    }

    return { withoutFallback, withFallback };
}
