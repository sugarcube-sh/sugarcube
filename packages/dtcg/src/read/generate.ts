import { getEffectiveSettings } from "./inherit.js";
import type { Settings } from "./settings.js";
import { tokenPath } from "../path.js";
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
} from "../model.js";
import { parseReference } from "../values/references.js";
import {
    type CheckedExtension,
    type ExtensionProblem,
    type SchemaOutput,
    ReportDeduper,
    checkSchema,
    findExtension,
    extensionDiagnostic,
} from "./extension-check.js";
import { diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import { type JsonFile, getKeyNode, toSpan } from "./json.js";
import { relatedMessages } from "../error-messages.js";
import type { Merged, MergedToken } from "./merge.js";
import { toValidType } from "./walk.js";

interface Extension {
    value: unknown;
    json: JsonFile;
    node: Node;
    source: number;
    group: string;
}

/**
 * Defines a {@link Generator}.
 *
 * TypeScript checks that each error `generate` returns has a message in `messages`. With a
 * `schema`, `generate` gets the schema's output.
 *
 * @param generator - The generator, with its `extension`, `messages` and `generate`.
 *
 * @example
 * // Makes space.1 to space.4 from { "steps": 4 } on the space group
 * const steps = defineGenerator({
 *     extension: ["com.example", "steps"],
 *     messages: {
 *         "not-a-count": ({ steps }: { steps: unknown }) =>
 *             `\`steps\` must be a whole number above 0, not ${JSON.stringify(steps)}`,
 *     },
 *     generate: (group, steps) =>
 *         typeof steps === "number"
 *             ? {
 *                   ok: true,
 *                   value: Array.from({ length: steps }, (_, i) => ({
 *                       name: `${i + 1}`,
 *                       $value: { value: i + 1, unit: "rem" },
 *                   })),
 *               }
 *             : { ok: false, errors: [{ jsonPath: [], reason: "not-a-count", data: { steps } }] },
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

export function runGenerators(
    merged: Merged,
    generators: readonly Generator[],
    { input, parseOptions }: { input: Input; parseOptions: ParseOptions },
    diagnostics: DiagnosticCollector,
): void {
    const added = new Map<string, MergedToken>();
    const reported = new ReportDeduper();
    const reportedIgnored = new ReportDeduper();

    for (const [groupPath, group] of merged.groups) {
        const settings = getEffectiveSettings(merged, group);
        for (const generator of generators) {
            const extension = findGeneratorExtension(settings, generator.extension);
            if (!extension) continue;
            const checked: CheckedExtension = {
                keyPath: generator.extension,
                messages: generator.messages,
                json: extension.json,
                node: extension.node,
                path: groupPath,
            };
            const report = (problems: ExtensionProblem[], seen = reported) => {
                if (!seen.isFirst(generator, extension.node)) return;
                for (const each of problems)
                    diagnostics.add(extensionDiagnostic(each, checked), input);
            };
            const passed = checkSchema(generator.schema, extension.value, generator.extension[0]);
            if (!passed.ok) {
                report(passed.problems);
                continue;
            }
            const type = toValidType(settings.type);
            const result = generator.generate(
                { path: groupPath, ...(type && { type }) },
                passed.value,
                parseOptions,
            );
            if (result.ignored) report(result.ignored, reportedIgnored);
            if (!result.ok) {
                report(result.errors);
                continue;
            }
            const from = { from: groupPath, extension: generator.extension };
            for (const generated of result.value) {
                const problem = tokenPath.findNameProblem(generated.name);
                if (problem) {
                    const detail = { name: generated.name, ...problem };
                    diagnostics.add(
                        diagnostic("invalid-name", detail, {
                            span: toSpan(extension.json, extension.node),
                            path: groupPath,
                        }),
                        input,
                    );
                    continue;
                }
                const path = tokenPath.join(groupPath, generated.name);
                if (added.has(path)) continue;
                const existing = findExistingSpans(merged, path);
                if (existing) {
                    const detail = { path, ...from, declaredAs: existing.kind };
                    const relatedInformation = [
                        {
                            message: relatedMessages.madeByThisExtension,
                            span: toSpan(extension.json, extension.node),
                            path: extension.group,
                        },
                    ];
                    for (const span of existing.spans) {
                        diagnostics.add(
                            diagnostic("overridden-by-generator", detail, {
                                span,
                                path,
                                relatedInformation,
                            }),
                            input,
                        );
                    }
                    merged.order.delete(path);
                }
                added.set(path, createGeneratedToken(path, generated, from, extension));
            }
        }
    }
    for (const token of added.values()) {
        merged.tokens.set(token.path, token);
        merged.order.add(token.path);
    }
}

function findExistingSpans(
    merged: Merged,
    path: string,
): { kind: "token" | "group"; spans: Span[] } | undefined {
    const token = merged.tokens.get(path);
    if (token) {
        return {
            kind: "token",
            spans: [...(token.overridden ?? []), token].map(({ span }) => span),
        };
    }
    const group = merged.groups.get(path);
    if (group) return { kind: "group", spans: group.locations.map(({ span }) => span) };
    return undefined;
}

function findGeneratorExtension(
    settings: Settings,
    extension: Generator["extension"],
): Extension | undefined {
    const location = settings.extensionLocations?.[extension[0]];
    const found = findExtension(settings.extensions, location, extension);
    if (!location || !found) return undefined;
    const { json, source, group } = location;
    return { ...found, json, source, group };
}

function createGeneratedToken(
    path: string,
    { $type, $value, $description, $extensions }: GeneratedToken,
    generated: { from: string; extension: Generator["extension"] },
    { json, node, source }: Extension,
): MergedToken {
    return {
        path,
        json,
        value: node,
        originalValue: $value,
        reference: parseReference($value),
        span: toSpan(json, node),
        nameSpan: toSpan(json, getKeyNode(node)),
        source,
        generated,
        isGenerated: true,
        ...($type !== undefined && { type: $type }),
        ...($description !== undefined && { description: $description }),
        ...($extensions && { extensions: $extensions }),
    };
}
