import type { Committed } from "@sugarcube-sh/dtcg-edit";

export interface Held<T> {
    readonly value: T;
    readonly about: unknown;
}

export function heldFor<T>(held: Held<T> | undefined, about: unknown): T | undefined {
    return held !== undefined && held.about === about ? held.value : undefined;
}

export function reasonsFor(
    done: Pick<Committed, "refused" | "conflicts"> | undefined,
): readonly string[] {
    if (done?.refused) return [done.refused.reason];
    return (done?.conflicts ?? []).map((conflict) => conflict.reason);
}
