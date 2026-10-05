import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    ExtensionError,
    ExtensionMessages,
    GeneratedToken,
    Generator,
    StandardSchemaV1,
    IgnoredProperty,
    ValueError,
} from "../index.js";
import { isJsonObject } from "../values/json.js";
import { readAlias, readPointer } from "../values/references.js";
import {
    type CheckedExtension,
    type ExtensionProblem,
    type SchemaOutput,
    checkSchema,
    extensionDiagnostic,
} from "./extension-check.js";
import { type JsonFile, member, spanOf } from "./json.js";
import type { Merged, MergedGroup, MergedToken, Piece } from "./merge.js";

interface Extension {
    value: unknown;
    json: JsonFile;
    node: Node;
    piece: Piece;
}

/**
 * Defines a {@link Generator}, checking each error `generate` returns against its `messages`. With a
 * `schema`, `generate` receives the schema's output.
 *
 * @example
 * // { "space": { "$type": "dimension", "$extensions": { "com.example": { "steps": 4 } } } }
 * const steps = defineGenerator({
 *   extension: ["com.example", "steps"],
 *   messages: {
 *     "not-a-count": ({ steps }: { steps: unknown }) =>
 *       `\`steps\` must be a whole number above 0, not ${JSON.stringify(steps)}`,
 *   },
 *   generate: (group, steps) =>
 *     typeof steps === "number"
 *       ? {
 *           ok: true,
 *           value: Array.from({ length: steps }, (_, i) => ({
 *             name: `${i + 1}`,
 *             $value: { value: i + 1, unit: "rem" },
 *           })),
 *         }
 *       : { ok: false, errors: [{ path: [], reason: "not-a-count", data: { steps } }] },
 * });
 */
export function defineGenerator<
    const M extends ExtensionMessages = Record<never, never>,
    S extends StandardSchemaV1 | undefined = undefined,
>(
    generator: Omit<Generator, "schema" | "messages" | "generate"> & {
        schema?: S;
        messages?: M;
        generate: (
            group: Parameters<Generator["generate"]>[0],
            extension: SchemaOutput<S>,
        ) =>
            | { ok: true; value: GeneratedToken[]; ignored?: IgnoredProperty[] }
            | {
                  ok: false;
                  errors: (ExtensionError<NoInfer<M>> | ValueError)[];
                  ignored?: IgnoredProperty[];
              };
    },
): Generator {
    return generator;
}

export function fillGenerated(
    merged: Merged,
    generators: Generator[],
    permutation: number,
    diagnostics: Diagnostic[],
): void {
    const added: MergedToken[] = [];
    const addedPaths = new Set<string>();
    const reported = new Map<Generator, Set<Node>>();
    const reportedIgnored = new Map<Generator, Set<Node>>();

    for (const group of [merged.root, ...merged.groups.values()]) {
        for (const generator of generators) {
            const extension = extensionOf(group, generator.extension);
            if (!extension) continue;
            const checked: CheckedExtension = {
                within: generator.extension,
                messages: generator.messages,
                json: extension.json,
                node: extension.node,
                path: group.path,
                permutation,
            };
            const report = (problems: ExtensionProblem[], seen = reported) => {
                const done = seen.get(generator) ?? new Set<Node>();
                seen.set(generator, done);
                if (done.has(extension.node)) return;
                done.add(extension.node);
                for (const problem of problems) {
                    diagnostics.push(extensionDiagnostic(problem, checked));
                }
            };
            const passed = checkSchema(generator.schema, extension.value, generator.extension[0]);
            if (!passed.ok) {
                report(passed.problems);
                continue;
            }
            const type = group.type === "unusable" ? undefined : group.type;
            const result = generator.generate(
                { path: group.path, ...(type && { type }) },
                passed.value,
            );
            if (result.ignored) report(result.ignored, reportedIgnored);
            if (!result.ok) {
                report(result.errors);
                continue;
            }
            const from = { from: group.path };
            for (const made of result.value) {
                const path = group.path === "" ? made.name : `${group.path}.${made.name}`;
                const written = merged.tokens.get(path);
                if (written) merged.tokens.set(path, { ...written, generated: from });
                if (written || merged.groups.has(path) || addedPaths.has(path)) continue;
                addedPaths.add(path);
                added.push(addedToken(path, made, from, extension));
            }
        }
    }
    for (const token of added) merged.tokens.set(token.path, token);
}

function extensionOf(
    group: MergedGroup,
    [key, ...inside]: Generator["extension"],
): Extension | undefined {
    const at = group.extensionsAt?.[key];
    if (!at) return undefined;
    let value = group.extensions?.[key];
    let node: Node | undefined = member(at.node, key, at.json.hidden);
    for (const step of inside) {
        if (!isJsonObject(value) || !node) return undefined;
        value = value[step];
        node = member(node, step, at.json.hidden);
    }
    if (value === undefined || !node) return undefined;
    return { value, json: at.json, node, piece: at.piece };
}

function addedToken(
    path: string,
    { $type, $value, $description, $extensions }: GeneratedToken,
    generated: { from: string },
    { json, node, piece }: Extension,
): MergedToken {
    return {
        path,
        json,
        value: node,
        authored: $value,
        isReference: readAlias($value) !== undefined || readPointer($value) !== undefined,
        at: spanOf(json.path, json.lineStarts, node.offset, node.length),
        piece,
        generated,
        added: true,
        ...($type !== undefined && { type: $type }),
        ...($description !== undefined && { description: $description }),
        ...($extensions && { extensions: $extensions }),
    };
}
