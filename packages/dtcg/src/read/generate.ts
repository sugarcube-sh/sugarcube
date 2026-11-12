import { getEffectiveSettings } from "./inherit.js";
import type { Settings } from "./settings.js";
import { tokenPath } from "../path.js";
import type { Node } from "jsonc-parser";
import type {
    DiagnosticDetailByKind,
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
    options: { input: Input; parseOptions: ParseOptions },
    diagnostics: DiagnosticCollector,
): void {
    const run = new GeneratorRun(merged, options, diagnostics);
    for (const [path, group] of merged.groups) {
        const settings = getEffectiveSettings(merged, group);
        for (const generator of generators) run.runGenerator(generator, path, settings);
    }
    run.addTokens();
}

interface GeneratorCall {
    generator: Generator;
    group: string;
    settings: Settings;
    extension: Extension;
}

class GeneratorRun {
    readonly #merged: Merged;
    readonly #input: Input;
    readonly #parseOptions: ParseOptions;
    readonly #diagnostics: DiagnosticCollector;
    readonly #made = new Map<string, MergedToken>();
    readonly #reported = new ReportDeduper();
    readonly #reportedIgnored = new ReportDeduper();

    constructor(
        merged: Merged,
        { input, parseOptions }: { input: Input; parseOptions: ParseOptions },
        diagnostics: DiagnosticCollector,
    ) {
        this.#merged = merged;
        this.#input = input;
        this.#parseOptions = parseOptions;
        this.#diagnostics = diagnostics;
    }

    runGenerator(generator: Generator, group: string, settings: Settings): void {
        const extension = findGeneratorExtension(settings, generator.extension);
        if (!extension) return;

        const call = { generator, group, settings, extension };
        const generated = this.#generate(call);
        if (!generated) return;

        for (const each of generated) this.#addGeneratedToken(call, each);
    }

    addTokens(): void {
        for (const token of this.#made.values()) {
            this.#merged.tokens.set(token.path, token);
            this.#merged.order.add(token.path);
        }
    }

    #generate(call: GeneratorCall): GeneratedToken[] | undefined {
        const { generator, group, settings, extension } = call;
        const passed = checkSchema(generator.schema, extension.value, generator.extension[0]);
        if (!passed.ok) {
            this.#reportProblems(call, passed.problems, this.#reported);
            return undefined;
        }

        const type = toValidType(settings.type);
        const owner = { path: group, ...(type && { type }) };
        const result = generator.generate(owner, passed.value, this.#parseOptions);
        if (result.ignored) this.#reportProblems(call, result.ignored, this.#reportedIgnored);
        if (!result.ok) {
            this.#reportProblems(call, result.errors, this.#reported);
            return undefined;
        }
        return result.value;
    }

    #addGeneratedToken(call: GeneratorCall, generated: GeneratedToken): void {
        const { generator, group, extension } = call;
        const problem = tokenPath.findNameProblem(generated.name);
        if (problem) {
            this.#reportInvalidName(call, { name: generated.name, ...problem });
            return;
        }

        const path = tokenPath.join(group, generated.name);
        if (this.#made.has(path)) return;

        const from = { from: group, extension: generator.extension };
        const existing = findExistingSpans(this.#merged, path);
        if (existing) {
            this.#reportOverridden(call, path, existing);
            this.#merged.order.delete(path);
        }
        this.#made.set(path, createGeneratedToken(path, generated, from, extension));
    }

    #reportProblems(
        { generator, group, extension }: GeneratorCall,
        problems: ExtensionProblem[],
        reported: ReportDeduper,
    ): void {
        if (!reported.isFirst(generator, extension.node)) return;
        const checked: CheckedExtension = {
            keyPath: generator.extension,
            messages: generator.messages,
            json: extension.json,
            node: extension.node,
            path: group,
        };
        for (const each of problems) {
            this.#diagnostics.add(extensionDiagnostic(each, checked), this.#input);
        }
    }

    #reportInvalidName(
        { group, extension }: GeneratorCall,
        detail: DiagnosticDetailByKind["invalid-name"],
    ): void {
        const span = toSpan(extension.json, extension.node);
        this.#diagnostics.add(
            diagnostic("invalid-name", detail, { span, path: group }),
            this.#input,
        );
    }

    #reportOverridden(
        { generator, group, extension }: GeneratorCall,
        path: string,
        existing: { kind: "token" | "group"; spans: Span[] },
    ): void {
        const detail = {
            path,
            from: group,
            extension: generator.extension,
            declaredAs: existing.kind,
        };
        const relatedInformation = [
            {
                message: relatedMessages.madeByThisExtension,
                span: toSpan(extension.json, extension.node),
                path: extension.group,
            },
        ];
        for (const span of existing.spans) {
            const report = diagnostic("overridden-by-generator", detail, {
                span,
                path,
                relatedInformation,
            });
            this.#diagnostics.add(report, this.#input);
        }
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
