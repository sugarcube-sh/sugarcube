import type { Merged } from "./merge.js";

export type Reached =
    | { kind: "group"; path: string }
    | { kind: "token"; path: string }
    | { kind: "part"; token: string }
    | { kind: "nothing" };

export function reach(steps: string[] | undefined, merged: Merged): Reached {
    if (!steps) return { kind: "nothing" };
    const valueAt = steps.indexOf("$value");
    const path = (valueAt === -1 ? steps : steps.slice(0, valueAt)).join(".");
    if (merged.tokens.has(path)) {
        return valueAt === -1 ? { kind: "token", path } : { kind: "part", token: path };
    }
    if (valueAt === -1 && merged.groups.has(path)) return { kind: "group", path };
    return { kind: "nothing" };
}

export function refObjectMeaning(reached: Reached): "group" | "token" | "nothing" {
    if (reached.kind === "token" || reached.kind === "part") return "token";
    return reached.kind;
}
