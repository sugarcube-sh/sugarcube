import type { FileOps, FileWriteOp } from "@sugarcube-sh/studio/write-ops";

export type PRRequest = {
    title: string;
    description: string;
    files: FileOps[];
};

type Checked = { request: PRRequest } | { error: string };

const isPath = (value: unknown): value is Array<string | number> =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((segment) => typeof segment === "string" || typeof segment === "number");

function isOp(value: unknown): value is FileWriteOp {
    if (!value || typeof value !== "object") return false;
    const op = value as Record<string, unknown>;
    if (!isPath(op.path)) return false;
    switch (op.kind) {
        case "set":
        case "add":
            return "value" in op && op.value !== undefined;
        case "remove":
            return true;
        case "renameKey":
            return typeof op.name === "string" && op.name.length > 0;
        default:
            return false;
    }
}

export function checkRequest(body: unknown): Checked {
    const raw = body as Partial<Record<keyof PRRequest, unknown>> | null;
    if (!raw || typeof raw.title !== "string" || !raw.title) {
        return { error: "Missing required fields: title, files" };
    }
    if (!Array.isArray(raw.files) || raw.files.length === 0) {
        return { error: "Missing required fields: title, files" };
    }

    const folded = new Map<string, FileWriteOp[]>();
    for (const file of raw.files as Array<Record<string, unknown>>) {
        const path = file?.path;
        const ops = file?.ops;
        if (typeof path !== "string" || !path || !Array.isArray(ops) || ops.length === 0) {
            return { error: "Each file must have a path and at least one operation" };
        }
        if (!ops.every(isOp))
            return { error: `An operation for ${path} is not one Studio records` };
        const held = folded.get(path);
        if (held) held.push(...ops);
        else folded.set(path, [...ops]);
    }

    return {
        request: {
            title: raw.title,
            description: typeof raw.description === "string" ? raw.description : "",
            files: Array.from(folded, ([path, ops]) => ({ path, ops })),
        },
    };
}
