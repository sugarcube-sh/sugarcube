import type { Node } from "jsonc-parser";
import type { Diagnostic, GeneratedToken, Generator, ValueError } from "../index.js";
import { isPlainObject, readAlias, readPointer } from "../values/references.js";
import { diagnostic } from "./diagnostics.js";
import { type JsonFile, deepestNode, member, spanOf } from "./json.js";
import type { Merged, MergedGroup, MergedToken } from "./merge.js";

type Place = { index: number; offset: number };

interface Extension {
    value: unknown;
    json: JsonFile;
    node: Node;
    index: number;
}

/**
 * Defines a {@link Generator}.
 *
 * @example
 * // { "space": { "$type": "dimension", "$extensions": { "com.example": { "steps": 4 } } } }
 * const steps = defineGenerator({
 *   extension: ["com.example", "steps"],
 *   generate: (group, steps) =>
 *     typeof steps === "number"
 *       ? {
 *           ok: true,
 *           value: Array.from({ length: steps }, (_, i) => ({
 *             name: `${i + 1}`,
 *             $value: { value: i + 1, unit: "rem" },
 *           })),
 *         }
 *       : { ok: false, errors: [{ kind: "invalid-value", path: [], message: "steps must be a number" }] },
 * });
 */
export function defineGenerator(generator: Generator): Generator {
    return generator;
}

export function fillGenerated(
    merged: Merged,
    generators: Generator[],
    permutation: number,
    diagnostics: Diagnostic[],
): void {
    const added: { after: Place; tokens: MergedToken[] }[] = [];
    const addedPaths = new Set<string>();

    for (const group of [merged.root, ...merged.groups.values()]) {
        for (const generator of generators) {
            const extension = extensionOf(group, generator.extension);
            if (!extension) continue;
            const type = group.type === "unusable" ? undefined : group.type;
            const result = generator.generate(
                { path: group.path, ...(type && { type }) },
                extension.value,
            );
            if (!result.ok) {
                for (const error of result.errors) {
                    diagnostics.push(
                        invalidExtension(
                            group.path,
                            generator.extension,
                            extension,
                            error,
                            permutation,
                        ),
                    );
                }
                continue;
            }
            const from = { from: group.path };
            const tokens: MergedToken[] = [];
            for (const made of result.value) {
                const path = group.path === "" ? made.name : `${group.path}.${made.name}`;
                const written = merged.tokens.get(path);
                if (written) merged.tokens.set(path, { ...written, generated: from });
                if (written || merged.groups.has(path) || addedPaths.has(path)) continue;
                addedPaths.add(path);
                tokens.push(addedToken(path, made, from, extension));
            }
            const after = group.end ?? { index: Number.MAX_SAFE_INTEGER, offset: 0 };
            if (tokens.length > 0) added.push({ after, tokens });
        }
    }
    if (added.length > 0) placeAtGroupEnds(merged, added);
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
        if (!isPlainObject(value) || !node) return undefined;
        value = value[step];
        node = member(node, step, at.json.hidden);
    }
    if (value === undefined || !node) return undefined;
    return { value, json: at.json, node, index: at.index };
}

function placeAtGroupEnds(merged: Merged, added: { after: Place; tokens: MergedToken[] }[]) {
    const pending = [...added].sort((a, b) => compare(a.after, b.after));
    const tokens = new Map<string, MergedToken>();
    const add = (token: MergedToken) => tokens.set(token.path, token);
    let next = 0;
    const addPendingUpTo = (place: Place) => {
        for (; next < pending.length; next++) {
            const each = pending[next];
            if (!each || compare(each.after, place) > 0) return;
            each.tokens.forEach(add);
        }
    };
    for (const token of merged.tokens.values()) {
        addPendingUpTo({ index: token.index, offset: token.at.offset });
        add(token);
    }
    for (const { tokens: rest } of pending.slice(next)) rest.forEach(add);
    merged.tokens = tokens;
}

function compare(a: Place, b: Place): number {
    return a.index - b.index || a.offset - b.offset;
}

function addedToken(
    path: string,
    { $type, $value, $description, $extensions }: GeneratedToken,
    generated: { from: string },
    { json, node, index }: Extension,
): MergedToken {
    return {
        path,
        json,
        value: node,
        authored: $value,
        isReference: readAlias($value) !== undefined || readPointer($value) !== undefined,
        at: spanOf(json.path, json.lineStarts, node.offset, node.length),
        index,
        generated,
        added: true,
        ...($type !== undefined && { type: $type }),
        ...($description !== undefined && { description: $description }),
        ...($extensions && { extensions: $extensions }),
    };
}

function invalidExtension(
    path: string,
    extensionPath: Generator["extension"],
    { json, node }: Extension,
    error: ValueError,
    permutation: number,
): Diagnostic {
    const found = deepestNode(node, error.path, json.hidden);
    return diagnostic(
        "extension-invalid",
        {
            key: extensionPath[0],
            at: ["$extensions", ...extensionPath, ...error.path],
            ...(error.detail !== undefined && { reason: error.detail }),
        },
        {
            at: spanOf(json.path, json.lineStarts, found.offset, found.length),
            path,
            permutation,
        },
    );
}
