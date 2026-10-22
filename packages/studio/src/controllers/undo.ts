import type { JsonPath } from "@sugarcube-sh/dtcg";
import type { OpResult, StepOptions } from "@sugarcube-sh/dtcg-edit";
import type { Studio } from "./studio";

export interface Edit {
    readonly result: OpResult;
    readonly options: StepOptions;
}

export interface Field {
    readonly path: string;
    readonly writes: string;
    readonly place?: string | undefined;
    readonly part?: JsonPath | undefined;
    readonly control?: string | undefined;
}

export function fieldKey({ path, writes, place, part = [], control }: Field): string {
    return JSON.stringify([path, writes, place ?? null, part, control ?? null]);
}

export function changeBarActions({ state, save }: Pick<Studio, "state" | "save">) {
    const { changes, canUndo, canRedo, saving } = state;
    return {
        undo: canUndo && !saving,
        redo: canRedo && !saving,
        discard: changes.length > 0 && !saving,
        save: save !== undefined && changes.length > 0 && !saving,
    };
}

export interface KeyPress {
    readonly key: string;
    readonly metaKey: boolean;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
}

export function undoKey({ key, metaKey, ctrlKey, shiftKey, altKey }: KeyPress) {
    if (altKey || !(metaKey || ctrlKey)) return undefined;
    const pressed = key.toLowerCase();
    if (pressed === "z") return shiftKey ? "redo" : "undo";
    if (pressed === "y" && ctrlKey && !shiftKey) return "redo";
    return undefined;
}

export interface Focused {
    readonly tagName: string;
    readonly type: string;
    readonly isContentEditable: boolean;
}

const notTyped = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "radio",
    "range",
    "reset",
    "submit",
]);

export function isTyping({ tagName, type, isContentEditable }: Focused): boolean {
    if (isContentEditable || tagName === "TEXTAREA") return true;
    return tagName === "INPUT" && !notTyped.has(type);
}

export function undoFor(
    press: KeyPress,
    focused: Focused,
    offered: ReturnType<typeof changeBarActions>,
): "undo" | "redo" | undefined {
    const action = undoKey(press);
    return action && !isTyping(focused) && offered[action] ? action : undefined;
}
