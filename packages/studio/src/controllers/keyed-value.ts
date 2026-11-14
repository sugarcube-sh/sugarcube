import type { CommitResult } from "@sugarcube-sh/dtcg-edit";

export interface KeyedValue<T> {
    readonly value: T;
    readonly key: unknown;
}

export function getValueForKey<T>(keyed: KeyedValue<T> | undefined, key: unknown): T | undefined {
    return keyed !== undefined && keyed.key === key ? keyed.value : undefined;
}

export function getReasons(
    result: Pick<CommitResult, "refusal" | "conflicts"> | undefined,
): readonly string[] {
    if (result?.refusal) return [result.refusal.reason];
    return (result?.conflicts ?? []).map((conflict) => conflict.reason);
}
