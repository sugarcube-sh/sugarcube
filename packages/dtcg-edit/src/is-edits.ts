import type { Edits } from "./index.js";

/**
 * Whether a value is well-formed {@link Edits}: a list of steps, every edit in each one of the six
 * kinds, with the members its kind needs, and every move a `from` and a `to`. For edits from
 * outside the session, such as a request, a link or storage, before they go to
 * {@link Session.restore}, {@link changedFiles} or `applyToDisk`.
 *
 * @example
 * const sent: unknown = JSON.parse(body);
 * if (!isEdits(sent)) return badRequest();
 * session.restore(sent);
 */
export function isEdits(value: unknown): value is Edits {
    return isObject(value) && Array.isArray(value.steps) && value.steps.every(isStep);
}

function isStep(value: unknown): boolean {
    if (!isObject(value)) return false;
    const { ops, moves } = value;
    return Array.isArray(ops) && ops.every(isOp) && Array.isArray(moves) && moves.every(isMove);
}

function isOp(value: unknown): boolean {
    if (!isObject(value) || typeof value.file !== "string") return false;
    switch (value.kind) {
        case "set":
            return isJsonPath(value.jsonPath) && "value" in value && "was" in value;
        case "add":
            return isJsonPath(value.jsonPath) && "value" in value;
        case "remove":
            return isJsonPath(value.jsonPath) && "was" in value;
        case "renameKey":
            return isJsonPath(value.jsonPath) && typeof value.name === "string" && "was" in value;
        case "createFile":
            return "value" in value;
        case "deleteFile":
            return typeof value.was === "string";
        default:
            return false;
    }
}

function isMove(value: unknown): boolean {
    return isObject(value) && typeof value.from === "string" && typeof value.to === "string";
}

function isJsonPath(value: unknown): boolean {
    return (
        Array.isArray(value) &&
        value.every((step) => typeof step === "string" || typeof step === "number")
    );
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
