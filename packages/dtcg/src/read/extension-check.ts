import type { Node } from "jsonc-parser";
import { thrownMessages } from "../error-messages.js";
import type {
    Diagnostic,
    ExtensionError,
    ExtensionMessages,
    IgnoredProperty,
    JsonPath,
    StandardSchemaV1,
    ValueError,
} from "../model.js";
import { isJsonObject } from "../values/json.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, deepestNode, markedNode, member, toSpan } from "./json.js";
import { ignoredDiagnostic, valueDiagnostic } from "./value-diagnostic.js";
import type { ExtensionsAt } from "./walk.js";

export type SchemaOutput<S> = S extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<S>
    : unknown;

export type ExtensionProblem =
    | ExtensionError
    | ValueError
    | IgnoredProperty
    | { jsonPath: JsonPath; message: string };

export interface CheckedExtension {
    within: readonly [string, ...string[]];
    messages?: ExtensionMessages | undefined;
    json: JsonFile;
    node: Node;
    path: string;
}

export function findExtension(
    extensions: Readonly<Record<string, unknown>> | undefined,
    at: ExtensionsAt | undefined,
    [key, ...inside]: readonly [string, ...string[]],
): { value: unknown; node: Node } | undefined {
    if (!at) return undefined;
    let value = extensions?.[key];
    let node = member(at.node, key);
    for (const step of inside) {
        if (!isJsonObject(value) || !node) return undefined;
        value = value[step];
        node = member(node, step);
    }
    return value === undefined || !node ? undefined : { value, node };
}

export class Reported {
    readonly #seen = new Map<object, Set<Node>>();

    first(by: object, node: Node): boolean {
        const seen = this.#seen.get(by) ?? new Set<Node>();
        this.#seen.set(by, seen);
        if (seen.has(node)) return false;
        seen.add(node);
        return true;
    }
}

export function checkSchema(
    schema: StandardSchemaV1 | undefined,
    value: unknown,
    key: string,
): { ok: true; value: unknown } | { ok: false; problems: ExtensionProblem[] } {
    if (!schema) return { ok: true, value };
    const result = schema["~standard"].validate(value);
    if (result instanceof Promise) throw new TypeError(thrownMessages.asyncSchema(key));
    if (!result.issues) return { ok: true, value: result.value };
    return {
        ok: false,
        problems: result.issues.map(({ message, path }) => ({
            jsonPath: issuePath(path),
            message,
        })),
    };
}

function issuePath(path: StandardSchemaV1.Issue["path"]): JsonPath {
    const steps: (string | number)[] = [];
    for (const segment of path ?? []) {
        const key = typeof segment === "object" ? segment.key : segment;
        if (typeof key !== "string" && typeof key !== "number") break;
        steps.push(key);
    }
    return steps;
}

export function extensionDiagnostic(
    problem: ExtensionProblem,
    { within, messages, json, node, path }: CheckedExtension,
): Diagnostic {
    const jsonPath = ["$extensions", ...within, ...problem.jsonPath];
    if ("kind" in problem && problem.kind === "unknown-property") {
        const where = { node, steps: problem.jsonPath, json };
        return ignoredDiagnostic(problem, jsonPath, where, { ...(path !== undefined && { path }) });
    }
    const found = deepestNode(node, problem.jsonPath);
    const extra: DiagnosticExtra = {
        span: toSpan(json, markedNode(found)),
        ...(path !== undefined && { path }),
    };
    if ("kind" in problem) return valueDiagnostic(problem.detail, jsonPath, found, extra);

    const key = within[0];
    if ("message" in problem) {
        return diagnostic(
            "extension-invalid",
            { key, jsonPath },
            { ...extra, message: problem.message },
        );
    }
    const { reason, data } = problem;
    const worded = messages && Object.hasOwn(messages, reason) && messages[reason]?.(data);
    return diagnostic(
        "extension-invalid",
        { key, jsonPath, reason, ...(data !== undefined && { data }) },
        { ...extra, ...(typeof worded === "string" ? { message: worded } : worded) },
    );
}
