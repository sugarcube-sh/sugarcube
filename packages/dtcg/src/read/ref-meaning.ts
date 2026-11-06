import type { JsonPath, WrittenReference } from "../model.js";
import { isJsonObject } from "../values/json.js";
import type { Merged, MergedToken } from "./merge.js";
import { arrayIndex } from "./json.js";
import { refSteps } from "./pointer.js";

export type Reached =
    | { kind: "group"; path: string }
    | { kind: "token"; path: string; token: MergedToken }
    | { kind: "part"; path: string; token: MergedToken; inside: string[] }
    | { kind: "stops-at-token"; path: string }
    | { kind: "nothing" };

export interface Aim {
    reference: WrittenReference;
    steps: string[] | undefined;
}

export function toPointerSteps(reference: WrittenReference): string[] | undefined {
    return reference.syntax === "json-pointer" ? refSteps(reference.pointer) : undefined;
}

export function followReference({ reference, steps }: Aim, merged: Merged): Reached {
    if (reference.syntax === "json-pointer") return reach(steps, merged);
    const { path } = reference;
    const token = merged.tokens.get(path);
    if (token) return { kind: "token", path, token };
    return merged.groups.has(path) ? { kind: "group", path } : { kind: "nothing" };
}

export function reach(steps: string[] | undefined, merged: Merged): Reached {
    if (!steps) return { kind: "nothing" };
    const { path, inside } = pointerParts(steps);
    if (path === undefined) return { kind: "nothing" };
    const token = merged.tokens.get(path);
    if (token) {
        if (!inside) return { kind: "stops-at-token", path };
        return inside.length > 0
            ? { kind: "part", path, token, inside }
            : { kind: "token", path, token };
    }
    if (!inside && merged.groups.has(path)) return { kind: "group", path };
    return { kind: "nothing" };
}

export function toValuePointer(pointer: string): string {
    return `${pointer}/$value`;
}

export function pointerParts(steps: string[]): { path?: string; inside?: string[] } {
    const valueStep = steps.indexOf("$value");
    const before = valueStep === -1 ? steps : steps.slice(0, valueStep);
    if (before.includes("")) return {};
    return {
        path: before.join("."),
        ...(valueStep !== -1 && { inside: steps.slice(valueStep + 1) }),
    };
}

export function stepInto(
    raw: unknown,
    steps: string[],
): { value: unknown; property: JsonPath } | undefined {
    let current = raw;
    const property: (string | number)[] = [];
    for (const step of steps) {
        if (Array.isArray(current) && arrayIndex.test(step)) {
            current = current[Number(step)];
            property.push(Number(step));
        } else if (isJsonObject(current) && Object.hasOwn(current, step)) {
            current = current[step];
            property.push(step);
        } else return undefined;
        if (current === undefined) return undefined;
    }
    return { value: current, property };
}
