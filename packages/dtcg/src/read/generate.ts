import { applying } from "./inherit.js";
import type { Settings } from "./settings.js";
import { childPath, forbiddenInName } from "../path.js";
import type { Node } from "jsonc-parser";
import type {
    ExtensionError,
    ExtensionMessages,
    GeneratedToken,
    Generator,
    IgnoredProperty,
    Input,
    ParseOptions,
    Span,
    StandardSchemaV1,
    ValueError,
} from "../index.js";
import { readReference } from "../values/references.js";
import {
    type CheckedExtension,
    type ExtensionProblem,
    type SchemaOutput,
    Reported,
    checkSchema,
    extensionAt,
    extensionDiagnostic,
} from "./extension-check.js";
import { diagnostic, type Problems } from "./diagnostics.js";
import { type JsonFile, spanOf } from "./json.js";
import { relatedMessages } from "../error-messages.js";
import { type Merged, type MergedToken, everyGroup } from "./merge.js";
import { usableType } from "./walk.js";

interface Extension {
    value: unknown;
    json: JsonFile;
    node: Node;
    source: number;
    group?: string;
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
 *       : { ok: false, errors: [{ jsonPath: [], reason: "not-a-count", data: { steps } }] },
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
            options: ParseOptions,
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
    generators: readonly Generator[],
    { input, parseOptions }: { input: Input; parseOptions: ParseOptions },
    diagnostics: Problems,
): void {
    const added = new Map<string, MergedToken>();
    const reported = new Reported();
    const reportedIgnored = new Reported();

    for (const [groupPath, group] of everyGroup(merged)) {
        const settings = applying(merged, group);
        for (const generator of generators) {
            const extension = extensionOf(settings, generator.extension);
            if (!extension) continue;
            const checked: CheckedExtension = {
                within: generator.extension,
                messages: generator.messages,
                json: extension.json,
                node: extension.node,
                ...(groupPath !== undefined && { path: groupPath }),
            };
            const report = (problems: ExtensionProblem[], seen = reported) => {
                if (!seen.first(generator, extension.node)) return;
                for (const each of problems)
                    diagnostics.found(extensionDiagnostic(each, checked), input);
            };
            const passed = checkSchema(generator.schema, extension.value, generator.extension[0]);
            if (!passed.ok) {
                report(passed.problems);
                continue;
            }
            const type = usableType(settings.type);
            const result = generator.generate(
                { ...(groupPath !== undefined && { path: groupPath }), ...(type && { type }) },
                passed.value,
                parseOptions,
            );
            if (result.ignored) report(result.ignored, reportedIgnored);
            if (!result.ok) {
                report(result.errors);
                continue;
            }
            const from = {
                ...(groupPath !== undefined && { from: groupPath }),
                extension: generator.extension,
            };
            for (const made of result.value) {
                const character = forbiddenInName(made.name);
                if (character) {
                    const detail = { name: made.name, character };
                    diagnostics.found(
                        diagnostic("invalid-name", detail, {
                            span: spanOf(extension.json, extension.node),
                            ...(groupPath !== undefined && { path: groupPath }),
                        }),
                        input,
                    );
                    continue;
                }
                const path = childPath(groupPath, made.name);
                if (added.has(path)) continue;
                const written = writtenPlaces(merged, path);
                if (written) {
                    const detail = { path, ...from, written: written.kind };
                    const related = [
                        {
                            message: relatedMessages.madeByThisExtension,
                            span: spanOf(extension.json, extension.node),
                            ...(extension.group !== undefined && { path: extension.group }),
                        },
                    ];
                    for (const span of written.spans) {
                        diagnostics.found(
                            diagnostic("written-generated", detail, { span, path, related }),
                            input,
                        );
                    }
                    merged.order.delete(path);
                }
                added.set(path, addedToken(path, made, from, extension));
            }
        }
    }
    for (const token of added.values()) {
        merged.tokens.set(token.path, token);
        merged.order.add(token.path);
    }
}

function writtenPlaces(
    merged: Merged,
    path: string,
): { kind: "token" | "group"; spans: Span[] } | undefined {
    const token = merged.tokens.get(path);
    if (token) {
        return { kind: "token", spans: [...(token.replaces ?? []), token].map(({ span }) => span) };
    }
    const group = merged.groups.get(path);
    if (group) return { kind: "group", spans: group.declaredIn.map(({ span }) => span) };
    return undefined;
}

function extensionOf(settings: Settings, extension: Generator["extension"]): Extension | undefined {
    const written = settings.extensionsAt?.[extension[0]];
    const found = extensionAt(settings.extensions, written, extension);
    if (!written || !found) return undefined;
    const { json, source, group } = written;
    return { ...found, json, source, ...(group !== undefined && { group }) };
}

function addedToken(
    path: string,
    { $type, $value, $description, $extensions }: GeneratedToken,
    generated: { from?: string; extension: Generator["extension"] },
    { json, node, source }: Extension,
): MergedToken {
    return {
        path,
        json,
        value: node,
        authored: $value,
        reference: readReference($value),
        span: spanOf(json, node),
        source,
        generated,
        added: true,
        ...($type !== undefined && { type: $type }),
        ...($description !== undefined && { description: $description }),
        ...($extensions && { extensions: $extensions }),
    };
}
