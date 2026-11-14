import type { JsonPath } from "@sugarcube-sh/dtcg";
import type { OperationResult, StepOptions } from "@sugarcube-sh/dtcg-edit";
import type { Studio } from "./studio";

export interface Edit {
    readonly result: OperationResult;
    readonly options: StepOptions;
}

export interface MergeKeyInput {
    readonly path: string;
    readonly property: string;
    readonly row?: string | undefined;
    readonly part?: JsonPath | undefined;
    readonly control?: string | undefined;
}

export function createMergeKey({ path, property, row, part = [], control }: MergeKeyInput): string {
    return JSON.stringify([path, property, row ?? null, part, control ?? null]);
}

export function getChangeBarActions(
    { state, save }: Pick<Studio, "state" | "save">,
    { canSave }: { canSave: boolean } = { canSave: true },
) {
    const { changes, canUndo, canRedo, saving } = state;
    return {
        undo: canUndo && !saving,
        redo: canRedo && !saving,
        discard: changes.length > 0 && !saving,
        save: canSave && save !== undefined && changes.length > 0 && !saving,
    };
}

export interface KeyPress {
    readonly key: string;
    readonly metaKey: boolean;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
}

export function getUndoShortcut({ key, metaKey, ctrlKey, shiftKey, altKey }: KeyPress) {
    if (altKey || !(metaKey || ctrlKey)) return undefined;
    const pressed = key.toLowerCase();
    if (pressed === "z") return shiftKey ? "redo" : "undo";
    if (pressed === "y" && ctrlKey && !shiftKey) return "redo";
    return undefined;
}

export interface FocusedElement {
    readonly tagName: string;
    readonly type: string;
    readonly isContentEditable: boolean;
}

const nonTextInputTypes = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "radio",
    "range",
    "reset",
    "submit",
]);

export function isTyping({ tagName, type, isContentEditable }: FocusedElement): boolean {
    if (isContentEditable || tagName === "TEXTAREA") return true;
    return tagName === "INPUT" && !nonTextInputTypes.has(type);
}

export function getUndoAction(
    press: KeyPress,
    focused: FocusedElement,
    actions: ReturnType<typeof getChangeBarActions>,
): "undo" | "redo" | undefined {
    const action = getUndoShortcut(press);
    return action && !isTyping(focused) && actions[action] ? action : undefined;
}
